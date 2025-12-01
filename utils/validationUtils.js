/**
 * Проверяет, содержит ли объект авторизации все необходимые поля
 *
 * @param {Object} auth - Объект авторизации для проверки
 * @param {string} auth.access_token - Токен доступа
 * @param {string} auth.domain - Домен портала Bitrix24
 * @param {string} auth.refresh_token - Токен обновления
 * @param {string} auth.client_endpoint - Конечная точка API клиента
 * @returns {boolean} true, если объект содержит все необходимые поля, иначе false
 *
 * @example
 * const isValid = validateAuth({
 *   access_token: 'token123',
 *   domain: 'example.bitrix24.ru',
 *   refresh_token: 'refresh123',
 *   client_endpoint: 'https://example.bitrix24.ru/rest/'
 * });
 * // Вернет: true
 */
function validateAuth(auth) {
  const { access_token, domain, refresh_token, client_endpoint } = auth;
  return !!(access_token && domain && refresh_token && client_endpoint);
}

/**
 * Проверяет параметры запроса на корректность
 *
 * Функция проверяет наличие всех необходимых параметров для выполнения запроса
 * к API Bitrix24 и выбрасывает соответствующие исключения при их отсутствии.
 *
 * @param {string} method - Метод API Bitrix24
 * @param {Object} auth - Объект с данными авторизации
 * @param {string} auth.domain - Домен портала Bitrix24
 * @param {string} auth.client_endpoint - Конечная точка API
 * @param {string} auth.access_token - Токен доступа
 * @param {Object} config - Конфигурация API клиента
 * @param {string} config.client_id - Идентификатор приложения
 * @param {string} config.client_secret - Секретный ключ приложения
 * @throws {Error} Если отсутствует параметр method
 * @throws {Error} Если объект auth отсутствует или не является объектом
 * @throws {Error} Если в объекте auth отсутствуют обязательные поля
 * @throws {Error} Если отсутствует client_id или client_secret в конфигурации
 *
 * @example
 * try {
 *   validateRequest('crm.lead.get',
 *     { domain: 'example.bitrix24.ru', client_endpoint: 'https://example.bitrix24.ru/rest/', access_token: 'token123' },
 *     { client_id: 'app123', client_secret: 'secret456' }
 *   );
 * } catch (error) {
 *   console.error(error.message);
 * }
 */
function validateRequest(method, auth, config) {
  if (!method) {
    throw new Error('method parameter is required');
  }

  if (!auth || typeof auth !== 'object') {
    throw new Error('auth object is required');
  }

  if (!config.client_id) throw new Error('client_id required');
  if (!config.client_secret) throw new Error('client_secret required');
}

module.exports = {
  validateAuth,
  validateRequest,
};
