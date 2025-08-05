/**
 * Контроллер интенсивности запросов к Bitrix24 по алгоритму "дырявого ведра"
 * с глобальной очередью запросов для каждого портала
 */
class RequestLimiter {
  constructor(options = {}) {
    // Хранилище для состояния каждого портала
    this.portals = new Map();
    
    // Фиксированные параметры для обычного тарифа
    this.MAX_BUCKET = 50;     // Объем ведра (X): 50 единиц
    this.LEAK_RATE = 2;       // Скорость утечки (Y): 2 единицы в секунду
    
    // Максимальный размер очереди запросов для портала
    this.MAX_QUEUE_SIZE = options.maxQueueSize || 1000;
    
    // Инициализация логгера
    this.logger = options.logger || {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    };
  }

  /**
   * Устанавливает логгер для контроллера
   * @param {Object} logger - Объект логгера
   */
  setLogger(logger) {
    if (logger && typeof logger === 'object') {
      this.logger = logger;
    }
  }

  /**
   * Получает или создает состояние портала
   * @param {string} domain - Домен портала
   * @returns {Object} Состояние портала
   */
  getPortalState(domain) {
    if (!this.portals.has(domain)) {
      this.portals.set(domain, {
        counter: 0,                // Текущее значение счетчика
        lastUpdate: Date.now(),    // Время последнего обновления
        isBlocked: false,          // Флаг блокировки запросов
        blockUntil: 0,             // Время до которого действует блокировка
        queue: [],                 // Очередь ожидающих запросов
        isProcessingQueue: false,  // Флаг обработки очереди
        nextRequestTime: 0         // Время следующего разрешенного запроса
      });
    }
    
    return this.portals.get(domain);
  }

  /**
   * Обновляет счетчик с учетом утечки
   * @param {Object} portal - Состояние портала
   */
  updateCounter(portal) {
    const now = Date.now();
    const elapsedSeconds = (now - portal.lastUpdate) / 1000;
    
    if (elapsedSeconds > 0) {
      // Вычисляем, насколько уменьшился счетчик за прошедшее время
      const leakAmount = elapsedSeconds * this.LEAK_RATE;
      
      // Уменьшаем счетчик, но не ниже нуля
      portal.counter = Math.max(0, portal.counter - leakAmount);
      portal.lastUpdate = now;
    }
    
    // Проверяем, не истекла ли блокировка
    if (portal.isBlocked && now > portal.blockUntil) {
      portal.isBlocked = false;
    }
  }

  /**
   * Добавляет запрос в очередь портала
   * @param {string} domain - Домен портала
   * @param {string} method - Метод API
   * @returns {Promise<void>} Промис, который разрешится, когда запрос может быть выполнен
   */
  async enqueueRequest(domain, method = '') {
    const portal = this.getPortalState(domain);
    
    // Проверяем, не превышен ли размер очереди
    if (portal.queue.length >= this.MAX_QUEUE_SIZE) {
      throw new Error(`Превышен максимальный размер очереди запросов (${this.MAX_QUEUE_SIZE}) для домена ${domain}`);
    }
    
    // Создаем и возвращаем новый промис, который будет разрешен,
    // когда запрос может быть выполнен
    return new Promise((resolve, reject) => {
      portal.queue.push({
        method,
        resolve,
        reject,
        addedAt: Date.now()
      });
      
      // Запускаем обработку очереди, если она еще не запущена
      this.processQueue(domain);
    });
  }

  /**
   * Обрабатывает очередь запросов для портала
   * @param {string} domain - Домен портала
   */
  async processQueue(domain) {
    const portal = this.getPortalState(domain);
    
    // Если очередь пуста или уже обрабатывается, ничего не делаем
    if (portal.isProcessingQueue || portal.queue.length === 0) {
      return;
    }

    // Устанавливаем флаг обработки очереди
    portal.isProcessingQueue = true;
    
    try {
      // Обновляем счетчик с учетом утечки
      this.updateCounter(portal);
      
      // Проверяем блокировку
      if (portal.isBlocked) {
        const waitTime = portal.blockUntil - Date.now();
        if (waitTime > 0) {
          this.logger.warn(`Очередь ${domain}: ожидание ${waitTime}ms (блокировка)`, {
            domain,
            waitTime,
            queueLength: portal.queue.length,
            reason: 'portal_blocked'
          });
          
          // Ждем окончания блокировки и затем продолжаем обработку
          setTimeout(() => this.processQueue(domain), waitTime);
          return;
        }
      }
      
      // Обрабатываем очередь, пока она не опустеет
      while (portal.queue.length > 0) {
        // Проверяем, можно ли выполнить следующий запрос
        const now = Date.now();
        const timeUntilNextRequest = portal.nextRequestTime - now;
        
        if (timeUntilNextRequest > 0) {
          // Ждем до следующего разрешенного времени и продолжаем обработку
          setTimeout(() => this.processQueue(domain), timeUntilNextRequest);
          return;
        }
        
        // Получаем следующий запрос из очереди
        const request = portal.queue[0];
        
        // Увеличиваем счетчик
        portal.counter += 1;
        
        // Рассчитываем заполнение "ведра"
        const fillRatio = portal.counter / this.MAX_BUCKET;
        
        // Определяем задержку для следующего запроса
        let delay = 0;
        
        if (fillRatio > 0.8) {
          // Чем ближе к лимиту, тем длиннее пауза
          delay = Math.ceil((1000 / this.LEAK_RATE) * Math.pow(fillRatio, 2));
          
          if (delay > 100) { // Только для значимых задержек
            this.logger.warn(`Очередь ${domain}: замедление запросов на ${delay}ms`, {
              domain,
              apiMethod: request.method,
              delay,
              fillRatio: Math.round(fillRatio * 100),
              counter: portal.counter,
              maxBucket: this.MAX_BUCKET,
            });
          }
        }
        
        // Устанавливаем время следующего разрешенного запроса
        portal.nextRequestTime = now + delay;
        
        // Удаляем запрос из очереди
        portal.queue.shift();
        
        // Разрешаем промис, позволяя запросу выполниться
        request.resolve();
        
        // Если очередь не пуста, и есть задержка, приостанавливаем обработку
        if (portal.queue.length > 0 && delay > 0) {
          setTimeout(() => this.processQueue(domain), delay);
          return;
        }
      }
    } catch (error) {
      this.logger.error(`Ошибка при обработке очереди для ${domain}: ${error.message}`, {
        domain,
        error
      });
    } finally {
      // Сбрасываем флаг обработки очереди
      portal.isProcessingQueue = false;
      
      // Если в очереди появились новые запросы, запускаем обработку снова
      if (portal.queue.length > 0) {
        this.processQueue(domain);
      }
    }
  }

  /**
   * Ожидает возможности выполнить запрос к порталу
   * @param {string} domain - Домен портала
   * @param {string} [method=''] - Метод API Bitrix24
   * @returns {Promise<void>}
   */
  async throttle(domain, method = '') {
    // Используем очередь для контроля скорости запросов
    await this.enqueueRequest(domain, method);
  }

  /**
   * Обрабатывает ошибку превышения лимита
   * @param {string} domain - Домен портала
   * @param {Object} result - Результат запроса с возможной ошибкой
   * @param {string} [method=''] - Метод API, вызвавший ошибку
   */
  handleResponse(domain, result, method = '') {
    if (!domain || !result) return;
    
    // Проверяем наличие ошибки превышения лимита
    const isLimitError = 
      result.error === 'QUERY_LIMIT_EXCEEDED' || 
      (result.error_description && result.error_description.includes('limit exceeded')) ||
      (result.status === 503);
    
    if (!isLimitError) return;
    
    const portal = this.getPortalState(domain);
    
    // Устанавливаем блокировку на 5 секунд
    const blockTime = 5000;
    portal.isBlocked = true;
    portal.blockUntil = Date.now() + blockTime;
    
    // Заполняем "ведро" на 90%
    portal.counter = this.MAX_BUCKET * 0.9;
    
    this.logger.error(`Превышен лимит запросов для ${domain}! Блокировка на ${blockTime}ms`, {
      domain,
      apiMethod: method,
      blockTime,
      error: result.error,
      error_description: result.error_description,
      counter: portal.counter,
      maxBucket: this.MAX_BUCKET,
      queueLength: portal.queue.length
    });
  }
  
  /**
   * Получает статистику по всем порталам
   * @returns {Object} Статистика порталов
   */
  getStats() {
    const stats = {
      portals: {},
      totalQueued: 0
    };
    
    for (const [domain, portal] of this.portals.entries()) {
      stats.portals[domain] = {
        counter: portal.counter,
        isBlocked: portal.isBlocked,
        queueLength: portal.queue.length,
        fillRatio: Math.round((portal.counter / this.MAX_BUCKET) * 100)
      };
      
      stats.totalQueued += portal.queue.length;
    }
    
    return stats;
  }
}

// Создаем экземпляр с заглушкой логгера
const limiter = new RequestLimiter();

module.exports = limiter;