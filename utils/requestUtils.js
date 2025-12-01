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

/**
 * Извлекает домен из URL endpoint
 *
 * @param {string} endpoint - URL endpoint (например, client_endpoint)
 * @returns {string|null} - Домен или null в случае ошибки
 */
function extractDomainFromEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== 'string') return null;

  try {
    const url = new URL(endpoint);
    return url.hostname;
  } catch {
    return null;
  }
}

module.exports = {
  getDefaultHeaders,
  extractDomainFromEndpoint,
};
