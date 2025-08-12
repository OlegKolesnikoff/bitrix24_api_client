/**
 * Контроллер интенсивности запросов к Bitrix24 с очередью запросов для каждого портала
 * Обеспечивает последовательное выполнение запросов внутри одного портала
 * и параллельное выполнение между разными порталами
 */
class RequestLimiter {
  constructor(options = {}) {
    // Хранилище для состояния каждого портала
    this.portals = new Map();

    // Фиксированные параметры для обычного тарифа
    this.MAX_BUCKET = options.maxBucket || 50; // Объем ведра: 50 единиц
    this.LEAK_RATE = options.leakRate || 2; // Скорость утечки: 2 единицы в секунду

    // Минимальный интервал между запросами (мс)
    this.MIN_REQUEST_INTERVAL = options.minRequestInterval || 150;

    // Максимальное время блокировки при ошибке лимита (мс)
    this.MAX_BLOCK_TIME = options.maxBlockTime || 5000;

    // Инициализация логгера
    this.logger = options.logger || {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
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
    return this;
  }

  /**
   * Получает или создает состояние портала
   * @param {string} domain - Домен портала
   * @returns {Object} Состояние портала
   */
  getPortalState(domain) {
    if (!this.portals.has(domain)) {
      this.portals.set(domain, {
        counter: 0, // Текущее значение счетчика
        lastUpdate: Date.now(), // Время последнего обновления
        isBlocked: false, // Флаг блокировки запросов
        blockUntil: 0, // Время до которого действует блокировка
        lastRequestTime: 0, // Время последнего запроса
        queue: [], // Очередь запросов
        isProcessingQueue: false, // Флаг обработки очереди
        totalRequests: 0, // Общее количество запросов
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
   * @returns {Promise<void>} Промис, который разрешается, когда запрос может быть выполнен
   */
  throttle(domain, method = '') {
    if (!domain) {
      throw new Error('Не указан домен для throttle');
    }

    const portal = this.getPortalState(domain);
    portal.totalRequests++;

    // Создаем промис, который разрешится, когда запрос сможет быть выполнен
    return new Promise((resolve) => {
      // Создаем задачу без замыканий на внешний контекст
      const task = {
        method,
        addedAt: Date.now(),
        execute: () => {
          // После выполнения задачи увеличиваем счетчик
          portal.counter += 1;
          portal.lastRequestTime = Date.now();

          // Разрешаем промис (без возврата функции done, так как запросы последовательные)
          resolve();

          // Важно: обнуляем ссылки для предотвращения утечек
          task.execute = null;
        },
      };

      // Добавляем задачу в очередь
      portal.queue.push(task);

      // Запускаем обработку очереди, если она не запущена
      if (!portal.isProcessingQueue) {
        this.processQueue(domain).catch((error) => {
          this.logger.error(`Ошибка при обработке очереди для ${domain}: ${error.message}`, {
            error: error.message,
            domain,
            method,
          });
        });
      }
    });
  }

  /**
   * Обрабатывает очередь запросов для портала
   * @param {string} domain - Домен портала
   */
  async processQueue(domain) {
    const portal = this.getPortalState(domain);
    if (portal.queue.length === 0) return;

    try {
      if (portal.isProcessingQueue) return;
      portal.isProcessingQueue = true;

      // Обрабатываем очередь, пока в ней есть задачи
      while (portal.queue.length > 0) {
        // Обновляем счетчик с учетом "утечки"
        this.updateCounter(portal);

        // Проверяем и ожидаем, если портал заблокирован
        if (await this._checkAndWaitForBlockage(domain, portal)) continue;

        // Проверяем и ожидаем минимальный интервал между запросами
        await this._waitForMinInterval(domain, portal);

        // Проверяем и ожидаем, если "ведро" переполнено
        if (await this._checkAndWaitForBucket(domain, portal)) continue;

        // Извлекаем и выполняем задачу
        await this._executeNextTask(domain, portal);
      }
    } catch (error) {
      this.logger.error(`Ошибка при обработке очереди для ${domain}: ${error.message}`, {
        domain,
        error: error.message,
      });
    } finally {
      // Снимаем статус обработки
      portal.isProcessingQueue = false;

      // При необходимости перезапускаем обработку очереди
      this._scheduleQueueProcessingIfNeeded(domain, portal);
    }
  }

  /**
   * Проверяет, заблокирован ли портал, и ожидает окончания блокировки
   * @param {string} domain - Домен портала
   * @param {Object} portal - Состояние портала
   * @returns {Promise<boolean>} true, если была выполнена проверка блокировки и нужно продолжить цикл
   * @private
   */
  async _checkAndWaitForBlockage(domain, portal) {
    if (portal.isBlocked) {
      const now = Date.now();
      const waitTime = portal.blockUntil - now;

      if (waitTime > 0) {
        this.logger.warn(`Портал ${domain} заблокирован, ожидание ${waitTime}ms`, {
          domain,
          waitTime,
          blockUntil: new Date(portal.blockUntil).toISOString(),
        });

        // Ожидаем окончания блокировки
        await new Promise((resolve) => setTimeout(resolve, waitTime));

        // Обновляем счетчик после ожидания
        this.updateCounter(portal);
        return true; // Продолжить цикл
      } else {
        portal.isBlocked = false;
      }
    }
    return false;
  }

  /**
   * Проверяет минимальный интервал между запросами и ожидает при необходимости
   * @param {string} domain - Домен портала
   * @param {Object} portal - Состояние портала
   * @private
   */
  async _waitForMinInterval(domain, portal) {
    const now = Date.now();
    const timeSinceLastRequest = now - portal.lastRequestTime;

    if (portal.lastRequestTime > 0 && timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Проверяет, не переполнено ли "ведро", и ожидает освобождения места
   * @param {string} domain - Домен портала
   * @param {Object} portal - Состояние портала
   * @returns {Promise<boolean>} true, если ведро было переполнено и нужно продолжить цикл
   * @private
   */
  async _checkAndWaitForBucket(domain, portal) {
    if (portal.counter >= this.MAX_BUCKET) {
      // Вычисляем время ожидания для освобождения места в ведре
      const requestsToWaitFor = 1; // Ждем освобождения для 1 запроса
      const waitTime = Math.ceil((requestsToWaitFor / this.LEAK_RATE) * 1000);

      const method = portal.queue.length > 0 ? portal.queue[0].method : '';

      this.logger.warn(`Ведро переполнено для ${domain}, ожидание ${waitTime}ms`, {
        domain,
        apiMethod: method,
        counter: portal.counter,
        maxBucket: this.MAX_BUCKET,
        queueLength: portal.queue.length,
      });

      // Ожидаем освобождения места в ведре
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // Обновляем счетчик после ожидания
      this.updateCounter(portal);
      return true; // Продолжить цикл
    }
    return false;
  }

  /**
   * Извлекает и выполняет следующую задачу из очереди
   * @param {string} domain - Домен портала
   * @param {Object} portal - Состояние портала
   * @private
   */
  async _executeNextTask(domain, portal) {
    // Извлекаем задачу из начала очереди
    const task = portal.queue.shift();

    // Логируем состояние "ведра" периодически
    this._logBucketFillIfNeeded(domain, portal, task.method);

    try {
      // Выполняем задачу
      task.execute();
    } catch (taskError) {
      this.logger.error(`Ошибка при выполнении задачи для ${domain}: ${taskError.message}`, {
        domain,
        method: task.method,
        error: taskError.message,
      });
    }

    // Очищаем ссылки на задачу
    task.execute = null;
  }

  /**
   * Логирует заполненность "ведра" для диагностики
   * @param {string} domain - Домен портала
   * @param {Object} portal - Состояние портала
   * @param {string} method - Метод API
   * @private
   */
  _logBucketFillIfNeeded(domain, portal, method) {
    if (portal.totalRequests % 10 === 0) {
      const fillPercent = Math.round((portal.counter / this.MAX_BUCKET) * 100);
      this.logger.debug(`Заполненность ведра для ${domain}: ${fillPercent}%`, {
        domain,
        apiMethod: method,
        counter: portal.counter,
        maxBucket: this.MAX_BUCKET,
        queueLength: portal.queue.length,
      });
    }
  }

  /**
   * Планирует обработку очереди, если есть новые задачи
   * @param {string} domain - Домен портала
   * @param {Object} portal - Состояние портала
   * @private
   */
  _scheduleQueueProcessingIfNeeded(domain, portal) {
    // Проверяем, не появились ли новые задачи в очереди
    if (portal.queue.length > 0) {
      // Запускаем обработку очереди через setTimeout для предотвращения блокировки стека
      setTimeout(() => {
        this.processQueue(domain).catch((error) => {
          this.logger.error(`Ошибка при перезапуске очереди для ${domain}: ${error.message}`, {
            domain,
            error: error.message,
          });
        });
      }, 0);
    }

    // Периодическая очистка неиспользуемых порталов (переместим в основной метод)
    if (Math.random() < 0.05) {
      // ~5% шанс
      this.cleanupPortals();
    }
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
      result.status === 503;

    if (!isLimitError) return;

    const portal = this.getPortalState(domain);

    // Устанавливаем блокировку
    const blockTime = this.MAX_BLOCK_TIME;
    portal.isBlocked = true;
    portal.blockUntil = Date.now() + blockTime;

    // Заполняем "ведро" на 90%
    portal.counter = this.MAX_BUCKET * 0.9;

    this.logger.warn(`Превышен лимит запросов для ${domain}! Блокировка на ${blockTime}ms`, {
      domain,
      apiMethod: method,
      blockTime,
      error: result.error,
      error_description: result.error_description,
      counter: portal.counter,
      maxBucket: this.MAX_BUCKET,
      queueLength: portal.queue.length,
      status: result.status || 429, // Для совместимости с логгером
    });
  }

  /**
   * Очищает неиспользуемые порталы для экономии памяти
   */
  cleanupPortals() {
    const now = Date.now();
    const inactiveThreshold = 30 * 60 * 1000; // 30 минут
    let cleanedCount = 0;

    for (const [domain, portal] of this.portals.entries()) {
      // Если портал не использовался долгое время и очередь пуста
      if (portal.queue.length === 0 && now - portal.lastRequestTime > inactiveThreshold) {
        this.portals.delete(domain);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Очищено ${cleanedCount} неактивных порталов`);

      // Запускаем сборщик мусора, если доступен
      if (global.gc) {
        global.gc();
      }
    }
  }
}

// Создаем экземпляр лимитера
const limiter = new RequestLimiter();

module.exports = limiter;
