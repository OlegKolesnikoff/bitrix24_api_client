const { version } = require('./package.json');
const storeAuth = require('./utils/storeAuth');
const bitrixFetch = require('./utils/bitrixFetch');
const buildQuery = require('./utils/buildQuery');
const requestLimiter = require('./utils/requestLimiter');
const install = require('./src/install');
const { configureLogger, defaultLogger } = require('./utils/logFetch');
const { validateAuth, validateRequest, isValidOAuthEndpoint } = require('./utils/validationUtils');
const { convertToOAuthEndpoint, getDefaultHeaders } = require('./utils/requestUtils');
const { handleError } = require('./utils/errorHandler');

/**
 * Класс для работы с API Bitrix24
 *
 * Предоставляет функциональность для авторизации, выполнения запросов к API
 * и обновления токенов доступа.
 *
 * @class Bitrix24API
 * @since 1.0.0
 */
class Bitrix24API {
  /**
   * Версия клиента API
   * @private
   * @type {string}
   */
  static #VERSION = version;

  /**
   * Конечная точка для OAuth-авторизации
   * @private
   * @type {string}
   */
  static #OAUTH_TOKEN_ENDPOINT = 'https://oauth.bitrix.info/oauth/token/';

  /**
   * Конфигурация клиента API
   * @type {Object}
   * @property {string|null} client_id - Идентификатор приложения
   * @property {string|null} client_secret - Секретный ключ приложения
   * @property {Function} readAuth - Функция для чтения авторизации
   * @property {Function} writeAuth - Функция для записи авторизации
   * @property {Object} requestOptions - Настройки HTTP-запросов
   * @property {number} requestOptions.tryes - Количество попыток запроса
   * @property {number} requestOptions.pause - Пауза между попытками (мс)
   * @property {number} requestOptions.abortTimeout - Время ожидания (мс)
   * @property {string|null} proxy - Настройки прокси (null - без прокси)
   * @property {Object} requestOptions.logger - Объект для логирования
   * @property {Object} logger - Настройки логирования
   * @property {boolean} logger.enabled - Включено ли логирование
   * @property {string} logger.level - Уровень логирования
   */
  static config = {
    client_id: null,
    client_secret: null,
    readAuth: storeAuth.readAuth,
    writeAuth: storeAuth.writeAuth,
    requestOptions: {
      tryes: 3,
      pause: 1000,
      abortTimeout: 15000,
      logger: defaultLogger,
    },
    proxy: null, // Настройки прокси по умолчанию (null - без прокси)
    logger: {
      enabled: true,
      level: 'debug', // 'debug', 'info', 'warn', 'error'
    },
  };

  /**
   * Выполняет запрос к API Bitrix24
   *
   * Этот метод получает данные авторизации из хранилища, выполняет запрос
   * и автоматически обновляет токены доступа при необходимости.
   *
   * @param {string} method - Метод API Bitrix24
   * @param {Object} [params={}] - Параметры запроса
   * @param {Object} auth - Объект с данными авторизации или идентификатором
   * @returns {Promise<Object>} Ответ от Bitrix24 API
   * @example
   * // Получение списка лидов
   * const result = await Bitrix24API.call('crm.lead.list', { select: ['ID', 'TITLE'] }, { domain: 'example.bitrix24.ru' });
   */
  static async call(method, params = {}, auth) {
    validateRequest(method, auth, this.config);
    const query = { method, params };
    return this.#makeBitrixApiCall(query, auth);
  }

  /**
   * Выполняет прямой запрос к API Bitrix24 с переданной авторизацией
   *
   * В отличие от метода call, не выполняет получение авторизации из хранилища
   * и не обновляет токены при их истечении.
   *
   * @param {string} method - Метод API Bitrix24
   * @param {Object} [params={}] - Параметры запроса
   * @param {Object} directAuth - Объект с данными авторизации
   * @param {string} directAuth.domain - Домен Bitrix24
   * @param {string} directAuth.client_endpoint - URL REST API
   * @param {string} directAuth.access_token - Токен доступа
   * @returns {Promise<Object>} Ответ от Bitrix24 или объект ошибки
   * @example
   * // Прямой запрос с авторизацией
   * const result = await Bitrix24API.callDirect('crm.lead.get',
   *   { id: 123 },
   *   { domain: 'example.bitrix24.ru', client_endpoint: 'https://example.bitrix24.ru/rest/', access_token: 'token123' }
   * );
   */
  static async callDirect(method, params = {}, directAuth) {
    try {
      validateRequest(method, directAuth, this.config);

      // Формируем объект запроса в том же формате, что и для стандартного вызова
      const query = { method, params };

      // Используем существующий метод для подготовки запроса
      const requestData = this.#prepareApiRequest(query, directAuth);

      // Выполняем запрос с использованием общего метода
      return await this.#executeRequest(requestData);
    } catch (err) {
      return handleError(err);
    }
  }

  /**
   * Устанавливает приложение для работы с API Bitrix24
   *
   * Выполняет процесс установки приложения и сохраняет полученные токены доступа.
   *
   * @param {Object} auth - Объект с данными для авторизации
   * @returns {Promise<Object>} Результат установки приложения
   * @example
   * // Установка приложения
   * const result = await Bitrix24API.installApp({
   *   domain: 'example.bitrix24.ru',
   *   code: 'authorization_code_from_bitrix'
   * });
   */
  static async installApp(auth) {
    try {
      const authSetter = async (settings) => await this.#setAuth(settings, auth);
      return install(auth, authSetter);
    } catch (err) {
      return handleError(err);
    }
  }

  /**
   * Настраивает логирование для API
   *
   * Позволяет изменить параметры логирования запросов и ответов.
   *
   * @param {Object} options - Настройки логирования
   * @param {boolean} [options.enabled] - Включить/выключить логирование
   * @param {string} [options.level] - Уровень логирования ('debug', 'info', 'warn', 'error')
   * @example
   * // Настройка логирования
   * Bitrix24API.configureLogger({
   *   enabled: true,
   *   level: 'info'
   * });
   */
  static configureLogger(options) {
    this.config.logger = { ...this.config.logger, ...options };
    configureLogger(this.config.logger);

    // Передаем логгер в лимитер запросов
    requestLimiter.setLogger(this.config.requestOptions.logger);
  }

  /**
   * Получает настройки приложения из хранилища или из auth.
   *
   * @private
   * @param {Object} auth - Данные авторизации или идентификатор
   * @returns {Promise<Object|false>} Настройки приложения или false
   */
  static async #getAuth(auth) {
    const authData = await this.config.readAuth(auth);

    if (!authData) return false;

    if (validateAuth(authData)) {
      return authData;
    }

    return false;
  }

  /**
   * Сохраняет новые настройки приложения через кастомный обработчик или напрямую.
   *
   * @private
   * @param {Object} auth - Настройки авторизации для сохранения
   * @returns {Promise<boolean>} true если успешно, иначе false
   */
  static async #setAuth(auth) {
    if (validateAuth(auth)) {
      return await this.config.writeAuth(auth);
    }

    return false;
  }

  /**
   * Обновляет токен авторизации при его истечении.
   *
   * Запрашивает новый токен через refresh_token и повторяет исходный запрос
   * с обновленной авторизацией.
   *
   * @private
   * @param {Object} query - Исходный запрос
   * @param {Object} auth - Данные авторизации
   * @returns {Promise<Object|null>} Новый ответ или null
   */
  static async #refreshAuth(query, auth) {
    const refreshQuery = {
      this_auth: 'Y',
      method: 'oauth.token',
      params: {
        client_id: this.config.client_id,
        grant_type: 'refresh_token',
        client_secret: this.config.client_secret,
        refresh_token: auth.refresh_token,
      },
    };

    // Используем прямой вызов, чтобы избежать зацикливания
    const requestData = this.#prepareOAuthRequest(refreshQuery, auth);
    const updatedAuth = await this.#executeRequest(requestData);

    if (updatedAuth.error) return updatedAuth;

    const newAuth = {
      ...updatedAuth,
      domain: auth.domain,
    };

    const isSetAppSettings = await this.#setAuth(newAuth);

    if (isSetAppSettings) {
      return await this.call(query.method, query.params, newAuth);
    }
    return null;
  }

  /**
   * Основной метод для выполнения запросов к API Bitrix24
   *
   * Получает данные авторизации, подготавливает запрос, выполняет его
   * и обрабатывает результат, включая автоматическое обновление токенов.
   *
   * @private
   * @param {Object} query - Параметры запроса
   * @param {string} query.method - Метод API
   * @param {Object} query.params - Параметры метода
   * @param {Object} auth - Данные авторизации или идентификатор
   * @returns {Promise<Object>} Результат запроса
   */
  static async #makeBitrixApiCall(query, auth) {
    const appAuth = await this.#getAuth(auth);
    if (!appAuth) {
      return handleError({ name: 'AuthError', message: 'No valid auth found' });
    }

    // Применяем лимитирование для домена, передаем имя метода
    await requestLimiter.throttle(appAuth.domain, query.method || 'unknown');

    // Подготовка параметров запроса
    const requestData =
      query.this_auth === 'Y' ? this.#prepareOAuthRequest(query, appAuth) : this.#prepareApiRequest(query, appAuth);

    // Выполнение запроса
    const result = await this.#executeRequest(requestData);

    // Обработка результата и ошибок
    if (result?.error === 'expired_token' && !query.this_auth) {
      return await this.#refreshAuth(query, appAuth);
    }

    return result;
  }

  /**
   * Выполняет HTTP-запрос к API
   *
   * @private
   * @param {Object} requestData - Данные для запроса
   * @param {string} requestData.url - URL запроса
   * @param {Object} requestData.params - Параметры fetch
   * @param {Object} requestData.logContext - Контекст для логирования
   * @returns {Promise<Object>} Результат запроса
   */
  static async #executeRequest(requestData) {
    const { url, params, logContext } = requestData;
    return await bitrixFetch(url, params, {
      ...this.config.requestOptions,
      proxy: this.config.proxy,
      logContext,
    });
  }

  /**
   * Подготавливает запрос для OAuth-авторизации
   *
   * @private
   * @param {Object} query - Параметры запроса
   * @param {Object} auth - Данные авторизации
   * @returns {Object} Подготовленные данные запроса
   */
  static #prepareOAuthRequest(query, auth) {
    // Определяем OAuth endpoint
    let oauthEndpoint = this.#OAUTH_TOKEN_ENDPOINT;

    // Если в auth есть server_endpoint, пробуем его использовать
    if (auth.server_endpoint) {
      // Преобразуем URL в формат для OAuth
      const convertedEndpoint = convertToOAuthEndpoint(auth.server_endpoint);

      // Проверяем, что URL соответствует допустимым шаблонам
      if (isValidOAuthEndpoint(convertedEndpoint)) {
        oauthEndpoint = convertedEndpoint;
      }
    }

    const url = oauthEndpoint + '?' + buildQuery(query.params).toString();
    return {
      url,
      params: {
        method: 'GET',
        redirect: 'manual',
        headers: getDefaultHeaders(this.#VERSION),
      },
      logContext: {
        domain: auth.domain,
        apiMethod: 'oauth.token',
      },
    };
  }

  /**
   * Подготавливает запрос к API Bitrix24
   *
   * @private
   * @param {Object} query - Параметры запроса
   * @param {Object} appSettings - Настройки авторизации
   * @returns {Object} Подготовленные данные запроса
   */
  static #prepareApiRequest(query, appSettings) {
    const url = appSettings.client_endpoint + query.method + '.json';
    const params = {
      method: 'POST',
      redirect: 'manual',
      headers: getDefaultHeaders(this.#VERSION),
      body: buildQuery({ ...query.params, auth: appSettings.access_token }),
    };

    return {
      url,
      params,
      logContext: {
        domain: appSettings.domain,
        apiMethod: query.method,
      },
    };
  }
}

module.exports = Bitrix24API;
