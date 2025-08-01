/**
 * Модуль для управления логированием
 */
class Logger {
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

  log(level, message, data) {
    if (!this._shouldLog(level)) return;

    // Предварительная обработка данных
    const processedData = this._processLogData(data);

    // Извлекаем домен и метод для префикса
    const domain = processedData?.domain || 'unknown';
    const method = processedData?.apiMethod || 'unknown';
    let httpStatus = '';

    // Добавляем статус, если он есть
    if (processedData.status) {
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
      this.logger[level](`${prefix} ${message}`, this._safeStringify(data));
    } else {
      this.logger[level](`${prefix} ${message}`);
    }
  }

  debug(message, data) {
    this.log('debug', message, data);
  }
  info(message, data) {
    this.log('info', message, data);
  }
  warn(message, data) {
    this.log('warn', message, data);
  }
  error(message, data) {
    this.log('error', message, data);
  }

  /**
   * Обрабатывает тело запроса для логирования
   * @param {any} body - Тело запроса
   * @param {number} [maxLength=2000] - Максимальная длина для JSON, 500 для строк
   * @returns {Object|string|undefined} Обработанное тело запроса
   */
  _formatRequestBody(body, maxLength = 2000) {
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
   * @param {string} level - Уровень логирования
   * @returns {boolean} true если нужно логировать
   */
  _shouldLog(level) {
    if (!this.enabled) return false;
    return this.levelMap[level] >= this.levelMap[this.level];
  }

  // В классе Logger модифицируем метод _safeStringify:
  _safeStringify(data) {
    try {
      // Для обработки больших объектов
      const prepareForStringify = (obj, path = '', depth = 0) => {
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
   * @param {string} url - URL для обработки
   * @returns {string} URL с замаскированными чувствительными данными
   */
  _maskSensitiveDataInUrl(url) {
    if (!url || typeof url !== 'string') return url;

    try {
      // Парсим URL и параметры запроса
      const urlObj = new URL(url);
      const params = urlObj.searchParams;

      // Список чувствительных параметров для маскирования
      const sensitiveParams = [
        'client_id',
        'access_token',
        'refresh_token',
        'client_secret',
        'token',
        'auth',
        'password',
        'key',
        'secret',
      ];

      // Маскируем каждый чувствительный параметр
      let masked = false;
      sensitiveParams.forEach((param) => {
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

  _maskUrlWithRegex(url) {
    let maskedUrl = url;
    const regexPatterns = [
      /([?&](client_id|access_token|refresh_token|client_secret|token|auth|password|key|secret)=)([^&]+)/gi,
    ];

    regexPatterns.forEach((regex) => {
      maskedUrl = maskedUrl.replace(regex, '$1[REDACTED]');
    });

    return maskedUrl;
  }

  /**
   * Обрабатывает данные перед логированием
   * @private
   * @param {Object} data - Исходные данные
   * @returns {Object} Обработанные данные
   */
  _processLogData(data) {
    if (!data) return data;

    // Создаем копию, чтобы не модифицировать оригинальные данные
    const processedData = { ...data };

    // Обработка URL с чувствительными данными
    processedData.url &&= this._maskSensitiveDataInUrl(processedData.url);

    // Обработка тела запроса, если оно есть
    if ('body' in processedData) {
      processedData.body = this._formatRequestBody(processedData.body);
    }

    // Если мы передаем параметры запроса через ...params, проверяем отдельно
    if (!('body' in processedData) && 'method' in processedData && typeof processedData.body === 'undefined') {
      // Это, вероятно, параметры fetch с body
      if ('body' in processedData) {
        processedData.body = this._formatRequestBody(processedData.body);
      }
    }

    // Удаляем Signal из параметров (он может вызвать ошибки при сериализации)
    if (processedData.signal) {
      delete processedData.signal;
    }

    return processedData;
  }
}

// Экспортируем экземпляр по умолчанию
const defaultLogger = new Logger();

module.exports = {
  Logger,
  defaultLogger,

  // Функция для настройки логгера
  configureLogger: (options) => {
    Object.assign(defaultLogger, new Logger(options));
    return defaultLogger;
  },
};
