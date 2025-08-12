/**
 * Модуль для управления логированием запросов к Bitrix24 API
 *
 * Предоставляет функциональность для логирования HTTP запросов, ответов и ошибок
 * с автоматической маскировкой чувствительных данных и форматированием вывода.
 *
 * @class Logger
 * @since 1.0.0
 * @example
 * // Создание логгера с настройками
 * const logger = new Logger({
 *   enabled: true,
 *   level: 'info',
 *   truncateLength: 1000
 * });
 *
 * // Логирование запроса
 * logger.info('Отправка запроса', { url: 'https://api.example.com', method: 'GET' });
 */
class Logger {
  // Список чувствительных параметров для маскирования
  SENSITIVE_PARAMS = [
    'auth',
    'access_token',
    'refresh_token',
    'client_secret',
    'token',
    'password',
    'key',
    'secret',
    'code',
  ];

  /**
   * Создает новый экземпляр логгера
   *
   * @param {Object} [options={}] - Настройки логгера
   * @param {boolean} [options.enabled=true] - Включен ли логгер
   * @param {string} [options.level='error'] - Минимальный уровень логирования (debug, info, warn, error)
   * @param {Object} [options.logger=console] - Объект для вывода логов (по умолчанию console)
   * @param {number} [options.truncateLength=2000] - Максимальная длина данных для логирования
   * @memberof Logger
   * @since 1.0.0
   */
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.level = options.level || 'error'; // debug, info, warn, error
    this.logger = options.logger || console;
    this.truncateLength = options.truncateLength || 2000;

    // Создаем карту уровней для проверки
    this.levelMap = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
  }

  /**
   * Основной метод для логирования сообщений
   *
   * Обрабатывает данные, маскирует чувствительную информацию и выводит
   * отформатированное сообщение с префиксом, содержащим домен и метод API.
   *
   * @param {string} level - Уровень логирования (debug, info, warn, error)
   * @param {string} message - Сообщение для логирования
   * @param {Object} [data] - Дополнительные данные для логирования
   * @param {string} [data.domain] - Домен Bitrix24
   * @param {string} [data.apiMethod] - Метод API
   * @param {number} [data.status] - HTTP статус код
   * @param {Error} [data.error] - Объект ошибки
   * @memberof Logger
   * @since 1.0.0
   * @example
   * // Логирование успешного запроса
   * logger.log('info', 'Запрос выполнен', {
   *   domain: 'example.bitrix24.ru',
   *   apiMethod: 'user.get',
   *   status: 200
   * });
   */
  log(level, message, data) {
    if (!this._shouldLog(level)) return;

    // Предварительная обработка данных
    const processedData = this._processLogData(data);

    // Извлекаем домен и метод для префикса
    const domain = processedData?.domain || 'unknown';
    const method = processedData?.apiMethod || 'unknown';
    let httpStatus = '';

    // Добавляем статус, если он есть
    if (processedData?.status) {
      httpStatus = `[${processedData.status}]`;
    }

    const prefix = `[Bitrix24API][${domain}][${method}]${httpStatus}`;

    // Преобразуем ошибку в читаемый формат для консоли
    if (processedData?.error instanceof Error) {
      // Форматируем стек для лучшей читаемости в консоли
      const formattedStack = processedData.error.stack ? '\n  ' + processedData.error.stack.replace(/\n/g, '\n  ') : '';

      // Выводим отформатированное сообщение
      this.logger[level](`${prefix} ${message}`, {
        ...processedData,
        error: {
          name: processedData.error.name,
          message: processedData.error.message,
          stack: formattedStack,
          // Добавляем остальные свойства ошибки
          ...Object.getOwnPropertyNames(processedData.error).reduce((acc, key) => {
            if (!['name', 'message', 'stack'].includes(key)) {
              acc[key] = processedData.error[key];
            }
            return acc;
          }, {}),
        },
      });
      return;
    }

    // Обычный лог для данных без ошибок
    if (data) {
      this.logger[level](`${prefix} ${message}`, this._safeStringify(processedData));
    } else {
      this.logger[level](`${prefix} ${message}`);
    }
  }

  /**
   * Логирование отладочных сообщений
   *
   * @param {string} message - Сообщение для логирования
   * @param {Object} [data] - Дополнительные данные
   * @memberof Logger
   * @since 1.0.0
   * @example
   * logger.debug('Детали запроса', { params: { ID: 1 } });
   */
  debug(message, data) {
    this.log('debug', message, data);
  }

  /**
   * Логирование информационных сообщений
   *
   * @param {string} message - Сообщение для логирования
   * @param {Object} [data] - Дополнительные данные
   * @memberof Logger
   * @since 1.0.0
   * @example
   * logger.info('Запрос отправлен', { url: 'https://api.example.com' });
   */
  info(message, data) {
    this.log('info', message, data);
  }

  /**
   * Логирование предупреждений
   *
   * @param {string} message - Сообщение для логирования
   * @param {Object} [data] - Дополнительные данные
   * @memberof Logger
   * @since 1.0.0
   * @example
   * logger.warn('Медленный ответ', { responseTime: 5000 });
   */
  warn(message, data) {
    this.log('warn', message, data);
  }

  /**
   * Логирование ошибок
   *
   * @param {string} message - Сообщение для логирования
   * @param {Object} [data] - Дополнительные данные
   * @param {Error} [data.error] - Объект ошибки
   * @memberof Logger
   * @since 1.0.0
   * @example
   * logger.error('Ошибка запроса', { error: new Error('Connection failed') });
   */
  error(message, data) {
    this.log('error', message, data);
  }

  /**
   * Обрабатывает тело запроса для логирования
   *
   * Форматирует тело запроса, обрезает слишком длинные строки,
   * парсит JSON и возвращает объекты в удобном для логирования виде.
   *
   * @private
   * @param {any} body - Тело запроса
   * @param {number} [maxLength=2000] - Максимальная длина для JSON, 500 для строк
   * @returns {Object|string|undefined} Обработанное тело запроса
   * @memberof Logger
   * @since 1.0.0
   */
  _formatRequestBody(body, maxLength = 2000) {
    // Специальная обработка для URLSearchParams
    if (body instanceof URLSearchParams) {
      const result = {};
      for (const [key, value] of body.entries()) {
        if (this.SENSITIVE_PARAMS.includes(key)) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'string' && value.startsWith('data:image/')) {
          result[key] = this._maskBase64String(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    }
    // Если тело - строка
    if (typeof body === 'string') {
      // Пробуем определить, является ли это JSON
      try {
        // Пытаемся распарсить как JSON и вернуть объект
        const jsonBody = JSON.parse(body);
        // Возвращаем объект напрямую, без преобразования в строку
        return jsonBody;
      } catch {
        // Это обычная строка - обрезаем до 100 символов
        const strMaxLength = Math.min(500, maxLength);
        return body.length > strMaxLength ? body.substring(0, strMaxLength) + '...' : body;
      }
    }
    // Если тело - объект
    else if (body && typeof body === 'object') {
      // Возвращаем объект как есть
      return body;
    }

    // В остальных случаях не форматируем
    return undefined;
  }

  /**
   * Проверяет, нужно ли логировать сообщение указанного уровня
   *
   * Сравнивает уровень сообщения с минимальным уровнем логирования.
   * Если логгер отключен, всегда возвращает false.
   *
   * @private
   * @param {string} level - Уровень логирования для проверки
   * @returns {boolean} true если нужно логировать, false если нет
   * @memberof Logger
   * @since 1.0.0
   * @example
   * // При level='warn' и this.level='error'
   * logger._shouldLog('warn'); // false
   * logger._shouldLog('error'); // true
   */
  _shouldLog(level) {
    if (!this.enabled) return false;
    return this.levelMap[level] >= this.levelMap[this.level];
  }

  /**
   * Безопасно преобразует данные в JSON строку
   *
   * Обрабатывает циклические ссылки, ограничивает глубину вложенности,
   * форматирует объекты Error и маскирует чувствительные данные.
   *
   * @private
   * @param {any} data - Данные для преобразования в строку
   * @returns {string} JSON строка или строковое представление данных
   * @memberof Logger
   * @since 1.0.0
   * @example
   * // Обработка объекта с ошибкой
   * const result = logger._safeStringify({ error: new Error('Test') });
   * // Результат: отформатированный JSON с обработанным стеком ошибки
   */
  _safeStringify(data) {
    try {
      // Создаем множество для отслеживания уже обработанных объектов (предотвращаем циклические ссылки)
      const seen = new WeakSet();

      // Для обработки больших объектов
      const prepareForStringify = (obj, path = '', depth = 0) => {
        // Ранняя обработка URLSearchParams
        if (obj instanceof URLSearchParams) {
          const result = {};

          for (const [key, value] of obj.entries()) {
            if (this.SENSITIVE_PARAMS.includes(key)) {
              result[key] = '[REDACTED]';
            } else if (typeof value === 'string' && value.startsWith('data:image/')) {
              result[key] = this._maskBase64String(value);
            } else {
              result[key] = value;
            }
          }
          return result;
        }

        if (depth > 10) return '[Depth limit exceeded]'; // Ограничиваем глубину

        // Обработка объектов Error
        if (obj instanceof Error) {
          // Преобразуем стек ошибки в массив строк для лучшей читаемости
          const stackLines = obj.stack ? obj.stack.split('\n').map((line) => line.trim()) : [];

          return {
            name: obj.name,
            message: obj.message,
            code: obj.code,
            // Представляем стек как массив строк вместо единой строки с \n
            stack: stackLines,
            ...Object.getOwnPropertyNames(obj).reduce((acc, key) => {
              if (!['name', 'message', 'stack'].includes(key)) {
                acc[key] = prepareForStringify(obj[key], `${path}.${key}`, depth + 1);
              }
              return acc;
            }, {}),
          };
        }

        if (obj === null || typeof obj !== 'object') return obj;

        // Проверка на циклическую ссылку
        if (seen.has(obj)) {
          return '[Circular Reference]';
        }
        seen.add(obj);

        // Специальная обработка для stack в объектах ошибок
        if (path.endsWith('.stack') && typeof obj === 'string') {
          return obj.split('\n').map((line) => line.trim());
        }

        // Для массивов
        if (Array.isArray(obj)) {
          return obj.map((item, i) => prepareForStringify(item, `${path}[${i}]`, depth + 1));
        }

        // Для объектов
        const result = {};
        for (const key in obj) {
          // Пропускаем чувствительные данные
          if (['auth', 'access_token', 'refresh_token', 'Authorization'].includes(key)) {
            result[key] = '[REDACTED]';
            continue;
          }

          const fullPath = path ? `${path}.${key}` : key;

          // Особая обработка стеков ошибок
          if (key === 'stack' && typeof obj[key] === 'string') {
            result[key] = obj[key].split('\n').map((line) => line.trim());
            continue;
          }

          // Маскируем URL в строковых значениях
          if (typeof obj[key] === 'string' && (obj[key].includes('http') || key.toLowerCase().includes('url'))) {
            result[key] = this._maskSensitiveDataInUrl(obj[key]);
            continue;
          }

          // Проверка размера для конкретных полей (body, result и т.д.)
          result[key] = prepareForStringify(obj[key], fullPath, depth + 1);
        }
        return result;
      };

      const prepared = prepareForStringify(data);
      return JSON.stringify(prepared, null, 2);
    } catch {
      return String(data);
    }
  }

  /**
   * Маскирует чувствительные данные в URL
   *
   * Заменяет значения параметров токенов, ключей и паролей на '[REDACTED]'
   * для предотвращения утечки чувствительной информации в логах.
   *
   * @private
   * @param {string} url - URL для обработки
   * @returns {string} URL с замаскированными чувствительными данными
   * @memberof Logger
   * @since 1.0.0
   * @example
   * // Маскирование токена в URL
   * const maskedUrl = logger._maskSensitiveDataInUrl(
   *   'https://api.example.com?access_token=secret123'
   * );
   * // Результат: 'https://api.example.com?access_token=[REDACTED]'
   */
  _maskSensitiveDataInUrl(url) {
    if (!url || typeof url !== 'string') return url;

    try {
      // Парсим URL и параметры запроса
      const urlObj = new URL(url);
      const params = urlObj.searchParams;

      // Маскируем каждый чувствительный параметр
      let masked = false;
      this.SENSITIVE_PARAMS.forEach((param) => {
        if (params.has(param)) {
          params.set(param, '[REDACTED]');
          masked = true;
        }
      });

      // Возвращаем обработанный URL
      const result = urlObj.toString();

      // Если маскировка не сработала через URL API, используем регулярные выражения
      return masked ? result : this._maskUrlWithRegex(url);
    } catch {
      // Если не можем распарсить URL, используем регулярные выражения
      return this._maskUrlWithRegex(url);
    }
  }

  /**
   * Маскирует чувствительные данные в URL с помощью регулярных выражений
   *
   * Резервный метод для маскирования URL, когда URL API не может распарсить строку.
   * Использует регулярные выражения для поиска и замены чувствительных параметров.
   *
   * @private
   * @param {string} url - URL для обработки
   * @returns {string} URL с замаскированными чувствительными данными
   * @memberof Logger
   * @since 1.0.0
   * @example
   * // Маскирование с помощью regex
   * const maskedUrl = logger._maskUrlWithRegex(
   *   'invalid-url?client_secret=secret123'
   * );
   * // Результат: 'invalid-url?client_secret=[REDACTED]'
   */
  _maskUrlWithRegex(url) {
    // Создаем более точное регулярное выражение для каждого параметра
    return this.SENSITIVE_PARAMS.reduce((maskedUrl, param) => {
      const regex = new RegExp(`([?&]${param}=)([^&]+)`, 'gi');
      return maskedUrl.replace(regex, '$1[REDACTED]');
    }, url);
  }

  /**
   * Обрабатывает данные перед логированием
   *
   * Создает копию данных, маскирует чувствительную информацию в URL,
   * форматирует тело запроса и удаляет проблематичные объекты.
   *
   * @private
   * @param {Object} data - Исходные данные для обработки
   * @returns {Object} Обработанные данные, готовые для логирования
   * @memberof Logger
   * @since 1.0.0
   */
  _processLogData(data) {
    if (!data) return data;

    // Создаем копию, чтобы не модифицировать оригинальные данные
    const processedData = { ...data };

    // Удаляем заголовки из ответа для логирования
    if (processedData.headers) {
      delete processedData.headers;
    }

    // Специальная обработка для URLSearchParams в body
    if (processedData.body instanceof URLSearchParams) {
      // Сразу преобразуем в обычный объект с маскированием
      const bodyObj = {};
      for (const [key, value] of processedData.body.entries()) {
        if (this.SENSITIVE_PARAMS.includes(key)) {
          bodyObj[key] = '[REDACTED]';
        } else if (typeof value === 'string' && value.startsWith('data:image/')) {
          bodyObj[key] = this._maskBase64String(value);
        } else {
          bodyObj[key] = value;
        }
      }
      processedData.body = bodyObj;
    }

    // Обработка URL с чувствительными данными
    processedData.url &&= this._maskSensitiveDataInUrl(processedData.url);

    // Рекурсивно проверяем вложенные объекты на наличие URL и маскируем их
    Object.keys(processedData).forEach((key) => {
      if (
        typeof processedData[key] === 'string' &&
        (processedData[key].includes('http') || key.toLowerCase().includes('url'))
      ) {
        processedData[key] = this._maskSensitiveDataInUrl(processedData[key]);
      } else if (typeof processedData[key] === 'object' && processedData[key] !== null) {
        // Рекурсивно обрабатываем вложенные объекты
        processedData[key] = this._processNestedObject(processedData[key]);
      }
    });

    // Если другие параметры запроса через ...params
    if ('body' in processedData) {
      processedData.body = this._formatRequestBody(processedData.body);
    }

    // Удаляем Signal из параметров
    if (processedData.signal) {
      delete processedData.signal;
    }

    return processedData;
  }

  /**
   * Маскирует base64 строки для предотвращения переполнения логов
   * @private
   * @param {string} value - Строка для проверки
   * @returns {string} Оригинальная строка или сокращенная версия, если это base64
   * @memberof Logger
   * @since 0.2.2
   */
  _maskBase64String(value) {
    if (typeof value !== 'string') return value;

    // Проверка на base64-кодированное изображение
    const base64ImagePattern = /^data:image\/[a-z]+;base64,/i;
    if (base64ImagePattern.test(value)) {
      const type = value.match(/^data:image\/([a-z]+);base64,/i)?.[1] || 'unknown';
      return `[IMAGE BASE64 DATA type=${type}, length=${value.length}]`;
    }

    // Проверка для других base64 строк (общий случай, если строка длинная и похожа на base64)
    if (value.length > 500 && /^[A-Za-z0-9+/=]{500,}$/.test(value)) {
      return `[BASE64 DATA length=${value.length}]`;
    }

    return value;
  }

  _processNestedObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const result = Array.isArray(obj) ? [...obj] : { ...obj };

    Object.keys(result).forEach((key) => {
      // Маскируем чувствительные ключи
      if (this.SENSITIVE_PARAMS.includes(key)) {
        result[key] = '[REDACTED]';
      }
      // Маскируем URL и base64 в строковых значениях
      else if (typeof result[key] === 'string') {
        // Сначала маскируем base64 строки
        result[key] = this._maskBase64String(result[key]);

        // Затем проверяем URL
        if (result[key].includes('http') || key.toLowerCase().includes('url')) {
          result[key] = this._maskSensitiveDataInUrl(result[key]);
        }
      }
      // Рекурсивно обрабатываем вложенные объекты
      else if (typeof result[key] === 'object' && result[key] !== null) {
        result[key] = this._processNestedObject(result[key]);
      }
    });

    return result;
  }
}

// Экспортируем экземпляр по умолчанию
const defaultLogger = new Logger();

/**
 * Модуль экспорта логгера
 *
 * @module LogFetch
 * @since 1.0.0
 */
module.exports = {
  /**
   * Класс логгера
   * @type {Logger}
   */
  Logger,

  /**
   * Экземпляр логгера по умолчанию
   * @type {Logger}
   */
  defaultLogger,

  /**
   * Функция для настройки логгера по умолчанию
   *
   * Позволяет изменить настройки глобального логгера, используемого
   * во всем приложении.
   *
   * @function
   * @param {Object} options - Настройки для логгера
   * @param {boolean} [options.enabled] - Включить/выключить логирование
   * @param {string} [options.level] - Уровень логирования
   * @param {Object} [options.logger] - Объект для вывода логов
   * @param {number} [options.truncateLength] - Максимальная длина данных
   * @returns {Logger} Настроенный экземпляр логгера
   * @since 1.0.0
   * @example
   * // Настройка глобального логгера
   * const logger = configureLogger({
   *   enabled: true,
   *   level: 'debug',
   *   truncateLength: 1000
   * });
   */
  configureLogger: (options) => {
    Object.assign(defaultLogger, new Logger(options));
    return defaultLogger;
  },
};
