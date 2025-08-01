const { version } = require('./package.json');
const storeAuth = require('./utils/storeAuth');
const bitrixFetch = require('./utils/bitrixFetch');
const buildQuery = require('./utils/buildQuery');
const install = require('./src/install');
const { configureLogger, defaultLogger } = require('./utils/logFetch');

class Bitrix24API {
  static #VERSION = version;
  static #OAUTH_TOKEN_ENDPOINT = 'https://oauth.bitrix.info/oauth/token/';

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
    logger: {
      enabled: true,
      level: 'debug', // 'debug', 'info', 'warn', 'error'
    },
  };

  // Публичное API
  static async call(method, params = {}, auth) {
    try {
      this.#validateConfig();
      const query = { method, params };
      return this.#makeBitrixApiCall(query, auth);
    } catch (err) {
      return {
        error: 'module_error',
        description: `${err.name} ${err.message}`,
        stack: err.stack,
      };
    }
  }

  static async installApp(auth) {
    try {
      const authSetter = async (settings) => await this.#setAuth(settings, auth);
      return install(auth, authSetter);
    } catch (err) {
      return {
        error: 'module_error',
        description: `${err.name} ${err.message}`,
        stack: err.stack,
      };
    }
  }

  /**
   * Настраивает логирование для API
   * @param {Object} options - Настройки логирования
   */
  static configureLogger(options) {
    this.config.logger = { ...this.config.logger, ...options };
    configureLogger(this.config.logger);
  }

  // Приватные методы
  /**
   * Внутренний метод для выполнения fetch-запроса к Bitrix24.
   * @param {Object} query - Объект запроса.
   * @param {Object} auth - Данные авторизации.
   * @returns {Promise<Object>} Ответ от Bitrix24 или объект ошибки.
   */
  static async #makeBitrixApiCall(query, auth) {
    const appSettings = await this.#getAuth(auth);
    if (!appSettings) {
      return {
        error: 'no_install_app',
        error_description: 'error install app, pls install local application',
      };
    }
    let url;
    const params = {
      redirect: 'manual',
      headers: {
        'User-Agent': `bitrix24_api_client ${this.#VERSION}`,
      },
    };

    // Извлекаем домен из client_endpoint
    const domain = auth.domain;
    // Метод API из query.method

    const logContext = {
      domain,
      apiMethod: query.method, // По умолчанию используем метод из запроса
    };

    if (query.this_auth == 'Y') {
      logContext.apiMethod = 'oauth.token';
      url = this.#OAUTH_TOKEN_ENDPOINT + '?' + buildQuery(query.params).toString();
      params['method'] = 'GET';
    } else {
      url = appSettings.client_endpoint + query.method + '.json';
      query.params.auth = appSettings.access_token;
      params['body'] = buildQuery(query.params);
      params['method'] = 'POST';
    }

    const result = await bitrixFetch(url, params, {
      ...this.config.requestOptions,
      logContext,
    });

    if (result?.error == 'expired_token' && !query.this_auth) {
      return await this.#refreshAuth(query, auth);
    }

    return result;
  }

  /**
   * Обновляет токен авторизации при его истечении.
   * @param {Object} query - Исходный запрос.
   * @param {Object} auth - Данные авторизации.
   * @returns {Promise<Object|null>} Новый ответ или null.
   */
  static async #refreshAuth(query, auth) {
    // Сохраняем оригинальный домен клиента
    const appSettings = await this.#getAuth(auth);
    if (!appSettings) {
      return {
        error: 'no_install_app',
        error_description: 'error install app, pls install local application',
      };
    }
    const refreshQuery = {
      this_auth: 'Y',
      method: 'oauth.token',
      params: {
        client_id: this.config.client_id,
        grant_type: 'refresh_token',
        client_secret: this.config.client_secret,
        refresh_token: appSettings.refresh_token,
      },
    };
    const updatedAuth = await this.#makeBitrixApiCall(refreshQuery, auth);

    const newAuth = {
      ...updatedAuth,
      domain: appSettings.domain,
    };

    const isSetAppSettings = await this.#setAuth(newAuth);

    if (isSetAppSettings) {
      query.this_auth = 'N';
      return await this.#makeBitrixApiCall(query, auth);
    }
    return null;
  }

  /**
   * Получает настройки приложения из хранилища или из auth.
   * @param {Object} auth - Данные авторизации.
   * @returns {Promise<Object|false>} Настройки приложения или false.
   */
  static async #getAuth(auth) {
    const settingsData = await this.config.readAuth(auth);

    if (!settingsData) return false;

    const { access_token, domain, refresh_token, client_endpoint } = settingsData;

    if (access_token && domain && refresh_token && client_endpoint) {
      return settingsData;
    }

    return false;
  }

  /**
   * Сохраняет новые настройки приложения через кастомный обработчик или напрямую.
   * @param {Object} appSettings - Новые настройки.
   * @param {Object} auth - Данные авторизации.
   * @returns {Promise<boolean>} true если успешно, иначе false.
   */
  static async #setAuth(newAuth) {
    if (typeof newAuth === 'object' && newAuth !== null) {
      if (newAuth.domain && newAuth.access_token) {
        return await this.config.writeAuth(newAuth);
      }
    }
    return false;
  }

  static #validateConfig() {
    if (!this.config.client_id) throw new Error('client_id required');
    if (!this.config.client_secret) throw new Error('client_secret required');
  }
}

module.exports = Bitrix24API;
