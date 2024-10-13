const fs = require('fs');
const httpBuildQuery = require('./query');

module.exports = {
  _VERSION: '0.0.6',
  _BITRIX_AUTH_URL: 'https://oauth.bitrix.info/oauth/token/',
  // список возможных ошибок, на случай, если потребуется обработать определенную ошибку
  _BITRIX_ERRORS: {
    expired_token: 'expired token, cant get new auth? Check access oauth server.',
    invalid_token: 'invalid token, need reinstall application',
    invalid_grant: 'invalid grant, check out define C_REST_CLIENT_SECRET or C_REST_CLIENT_ID',
    invalid_client: 'invalid client, check out define C_REST_CLIENT_SECRET or C_REST_CLIENT_ID',
    QUERY_LIMIT_EXCEEDED: 'Too many requests, maximum 2 query by second',
    ERROR_METHOD_NOT_FOUND: "Method not found! You can see the permissions of the application: CRest::call('scope')",
    NO_AUTH_FOUND: 'Some setup error b24, check in table "b_module_to_module" event "OnRestCheckAuth"',
    INTERNAL_SERVER_ERROR: 'Server down, try later',
    CONNECTION_ERROR: 'Error connecting to authorization server',
  },

  _empty_settings_error: {
    error: 'no_install_app',
    error_description: 'error install app, pls install local application',
  },

  params: {
    C_REST_CLIENT_ID: null, // String
    C_REST_CLIENT_SECRET: null, // String
    authPath: null, // String
    getAuthHandler: null, // async function
    setAuthHandler: null, // async function
  },

  /* вызов одного метода REST API Битрикс24 */
  async call(method, params = {}, auth) {
    try {
      const query = { method, params };
      return this._callFetch(query, auth);
    } catch (err) {
      return {
        error: 'module_error',
        description: `${err.name} ${err.message}`,
        stack: err.stack
      };
    }
  },

  /* вызов пачки методов */
  async callBatch() {
    return {
      error: 'not supported',
      error_description: 'the method is currently not supported',
    };
  },

  /* метод формирует и выолняет запрос */
  async _callFetch(query, auth) {
    const appSettings = await this._getAppSettings(auth);
    if (!appSettings) return this._empty_settings_error;
    let url;
    const options = {
      redirect: 'manual',
      headers: {
        'User-Agent': `Bitrix24 Node.js client ${this._VERSION}`,
      },
    };
    // проверка является ли запрос авторзационным
    if (query.this_auth == 'Y') {
      url = this._BITRIX_AUTH_URL + '?' + httpBuildQuery(query.params).toString();
      options['method'] = 'GET';
    } else {
      url = appSettings.client_endpoint + query.method + '.json';
      query.params.auth = appSettings.access_token;
      options['body'] = httpBuildQuery(query.params);
      options['method'] = 'POST';
    }

    const result = await this._fetchHandle(url, options);

    if (result?.error == 'expired_token' && !query.this_auth) return await this._getNewAuth(query, auth);
    return result;
  },

  /* обёртка для fetch, для обработки ошибок и нестандартных сценариев */
  async _fetchHandle(url, params) {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    let response = await fetch(url, params);
    // обработка смены адреса портала
    if (response.status === 302) {
      const newUrl = response.headers.get('location');
      return await this._fetchHandle(newUrl, params);
    }

    if (response) {
      const contentType = response.headers.get('Content-Type');
      // обработка ответа отличного от ожидаемого JSON
      if (contentType === 'text/html') {
        return {
          error: 'ошибка преобразования в JSON',
          error_description: 'Сервер ответил отличным от JSON форматом',
          error_response: await response.text(),
        };
      }
      response = await response.json();
      return response;
    }
  },

  /* Получение данных авторизации и проверка их на валидность */
  async _getAppSettings(auth) {
    const settingsData = await this._getSettingData(auth);
    if (!settingsData) return false;
    const { access_token, domain, refresh_token, application_token, client_endpoint } = settingsData;
    if (access_token && domain && refresh_token && application_token && client_endpoint) return settingsData;
    return false;
  },

  /* Получение авторизационных данных */
  async _getSettingData(auth) {
    if (this.params.getAuthHandler) return await this.params.getAuthHandler(auth);
    const readSettings = fs.readFileSync(this.params.authPath);
    return JSON.parse(readSettings);
  },

  /* продление авторизации и повторная отправка текущего запроса */
  async _getNewAuth(query, auth) {
    const appSettings = await this._getAppSettings(auth);
    if (!appSettings) return this._empty_settings_error;
    const queryAuth = {
      this_auth: 'Y',
      params: {
        client_id: this.params.C_REST_CLIENT_ID,
        grant_type: 'refresh_token',
        client_secret: this.params.C_REST_CLIENT_SECRET,
        refresh_token: appSettings.refresh_token,
      },
    };
    const updatedAuth = await this._callFetch(queryAuth, auth);
    const isSetAppSettings = await this._setAppSettings(updatedAuth, auth);
    if (isSetAppSettings) {
      query.this_auth = 'N';
      return await this._callFetch(query, auth);
    }
    return null;
  },

  /* формирует авторизационные данные при установке или при обновлении токена  для записи*/
  async _setAppSettings(appSettings, auth) {
    if (typeof appSettings === 'object' && appSettings !== null) {
      const savedAppSettings = await this._getAppSettings(auth);
      if (savedAppSettings) appSettings = Object.assign(savedAppSettings, appSettings);
      return await this._setSettingsData(appSettings);
    }
    return false;
  },

  /* записывает данные при установке приложения или при обновлении токена */
  async _setSettingsData(appSettings) {
    // предполагается, что данный метод, будет переопределен, на запись данных в БД
    if (this.params.setAuthHandler) return await this.params.setAuthHandler(appSettings);
    fs.writeFileSync(this.params.authPath, JSON.stringify(appSettings));
    return true;
  },

  /* Установка приложения 
    - только REST
    - приложение с интерфейсом + REST
    request - тело запроса, который приходит на роут /install */
  async installApp(request) {
    const result = {
      rest_only: true,
      install: false,
    };
    const { event, auth, PLACEMENT } = request;

    // установка приложения без интерфейса
    if (event == 'ONAPPINSTALL' && auth) {
      result.install = await this._setAppSettings(auth, true);
      result['auth'] = auth;
      return result;
    }

    // установка приложения с интерфейсом, на странице приложения необходимо вызвать BX24.installFinish()
    if (PLACEMENT == 'DEFAULT') {
      const { AUTH_ID, AUTH_EXPIRES, APP_SID, REFRESH_ID, DOMAIN, member_id, status } = request;
      const auth = {
        access_token: AUTH_ID,
        expires_in: AUTH_EXPIRES,
        application_token: APP_SID,
        refresh_token: REFRESH_ID,
        domain: DOMAIN,
        client_endpoint: 'https://' + DOMAIN + '/rest/',
        member_id,
        status,
      };
      result.rest_only = false;
      result['auth'] = auth;
      result.install = await this._setAppSettings(auth, true);
      return result;
    }
  },
};
