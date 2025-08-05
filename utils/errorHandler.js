/**
 * Преобразует объект ошибки JavaScript в стандартизированный формат ответа
 * 
 * Эта функция используется для унификации обработки ошибок в API-клиенте.
 * Она создает объект с информацией об ошибке в формате, соответствующем
 * стандартам API Bitrix24.
 *
 * @param {Error|Object} err - Объект ошибки JavaScript или любой объект с полями name и message
 * @returns {Object} Стандартизированный объект ошибки
 * @returns {string} returns.error - Код ошибки ('module_error')
 * @returns {string} returns.description - Описание ошибки (имя и сообщение)
 * @returns {string|undefined} returns.stack - Стек вызовов (если доступен)
 * 
 * @example
 * try {
 *   // Какой-то код, который может вызвать ошибку
 * } catch (error) {
 *   return handleError(error);
 *   // Вернет: { error: 'module_error', description: 'TypeError Something went wrong', stack: '...' }
 * }
 */
function handleError(err) {
  return {
    error: 'module_error',
    description: `${err.name} ${err.message}`,
    stack: err.stack,
  };
}

module.exports = { handleError };