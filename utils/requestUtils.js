/**
 * Преобразует URL сервера Bitrix24 в формат OAuth endpoint
 *
 * Функция принимает URL в формате "https://oauth.bitrix.info/rest"
 * и преобразует его в формат для OAuth запросов: "https://oauth.bitrix.info/oauth/token/"
 *
 * @param {string} serverEndpoint - URL сервера Bitrix24
 * @returns {string|false} Преобразованный URL для OAuth запросов или false, если формат не соответствует ожидаемому
 *
 * @example
 * const oauthUrl = convertToOAuthEndpoint('https://oauth.bitrix.info/rest');
 * // Вернет: 'https://oauth.bitrix.info/oauth/token/'
 *
 * const invalidResult = convertToOAuthEndpoint('https://example.com/rest');
 * // Вернет: false
 */
function convertToOAuthEndpoint(serverEndpoint) {
  // Удаляем завершающий слеш, если он есть
  const normalizedUrl = serverEndpoint.endsWith('/') ? serverEndpoint.slice(0, -1) : serverEndpoint;

  // Проверяем базовый формат URL
  if (!normalizedUrl.match(/^https:\/\/oauth\.bitrix\d*\.(tech|info)\/rest$/)) {
    return false;
  }

  // Заменяем "/rest" на "/oauth/token/"
  return normalizedUrl.replace(/\/rest$/, '/oauth/token/');
}

/**
 * Возвращает стандартные заголовки для запросов к API Bitrix24
 *
 * @param {string} version - Версия API клиента
 * @returns {Object} Объект с заголовками запроса
 * @returns {string} returns.User-Agent - Строка идентификации клиента с версией
 *
 * @example
 * const headers = getDefaultHeaders('1.0.0');
 * // Вернет: { 'User-Agent': 'bitrix24_api_client 1.0.0' }
 */
function getDefaultHeaders(version) {
  return {
    'User-Agent': `bitrix24_api_client ${version}`,
  };
}

module.exports = {
  convertToOAuthEndpoint,
  getDefaultHeaders,
};
