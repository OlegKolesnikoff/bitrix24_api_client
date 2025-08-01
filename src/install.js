/**
 * Устанавливает приложение Bitrix24.
 * @param {Object} request - Данные запроса установки.
 * @returns {Promise<Object>} Результат установки приложения.
 */
async function installApp(request, setAuthFunction) {
  try {
    const result = {
      rest_only: true,
      install: false,
    };
    const { event, auth, PLACEMENT } = request;

    // установка приложения без интерфейса
    if (event == 'ONAPPINSTALL' && auth) {
      result.install = await setAuthFunction(auth, true);
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
      result.install = await setAuthFunction(auth, true);
      return result;
    }
  } catch (err) {
    return {
      error: 'install_error',
      description: `${err.name} ${err.message}`,
      stack: err.stack,
    };
  }
}

module.exports = installApp;
