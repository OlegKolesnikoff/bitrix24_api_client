/**
 * @class BitrixApiError
 * @description Класс для представления ошибок API Bitrix
 * @classdesc Предоставляет структурированный формат ошибок при работе с API Bitrix24
 */
class BitrixApiError {
  /**
   * Создает экземпляр ошибки API Bitrix
   * @constructor
   * @param {string} type - Тип ошибки
   * @param {string} description - Описание ошибки
   * @param {Object} details - Дополнительные данные об ошибке
   */
  constructor(type, description, details = {}) {
    this.error = type;
    this.error_description = description;
    this.timestamp = new Date().toISOString();

    // Добавляем все детали как свойства
    Object.assign(this, details);
  }

  /**
   * Создает ошибку сетевого уровня
   * @static
   * @param {Error} error - Исходная ошибка сети
   * @param {boolean} retriesExhausted - Флаг, указывающий, что исчерпаны все попытки повтора
   * @returns {BitrixApiError} Экземпляр ошибки сетевого уровня
   */
  static network(error, retriesExhausted) {
    return new BitrixApiError('network_error', `Сетевая ошибка: ${error.message}`, {
      original_error: error,
      retries_exhausted: retriesExhausted,
    });
  }

  /**
   * Создает ошибку уровня клиента (4xx)
   * @static
   * @param {Response} response - Объект ответа HTTP
   * @param {Object} errorData - Данные об ошибке от Bitrix API
   * @returns {BitrixApiError} Экземпляр ошибки уровня клиента
   */
  static client(response, errorData) {
    const error_description = errorData?.error_description || 'Ошибка клиента: неизвестная ошибка';
    const error_bitrix_name = errorData?.error || 'неизвестное имя ошибки';
    return new BitrixApiError('client_error', error_description, {
      error_bitrix_name,
      status: response.status,
      body: errorData,
    });
  }

  /**
   * Создает ошибку уровня сервера (5xx)
   * @static
   * @param {Response} response - Объект ответа HTTP
   * @param {Object} errorData - Данные об ошибке от Bitrix API
   * @returns {BitrixApiError} Экземпляр ошибки уровня сервера
   */
  static server(response, errorData) {
    const error_description = errorData?.error_description || 'Ошибка сервера: неизвестная ошибка';
    const error_bitrix_name = errorData?.error || 'неизвестное имя ошибки';
    return new BitrixApiError('server_error', error_description, {
      error_bitrix_name,
      status: response.status,
      bitrix_error: errorData,
    });
  }

  /**
   * Создает ошибку редиректа
   * @static
   * @param {Response} response - Объект ответа HTTP
   * @param {string} message - Сообщение об ошибке
   * @param {Object} errorData - Данные об ошибке от Bitrix API
   * @returns {BitrixApiError} Экземпляр ошибки редиректа
   */
  static redirect(response, message, errorData) {
    return new BitrixApiError('redirect_error', message, { status: response.status, bitrix_error: errorData });
  }

  /**
   * Создает ошибку разбора ответа
   * @static
   * @param {Error} error - Объект ошибки парсинга
   * @param {Response} response - Исходный HTTP-ответ
   * @returns {BitrixApiError} Экземпляр ошибки парсинга ответа
   */
  static parseError(error, response) {
    return new BitrixApiError('response_parse_error', `Ошибка при разборе ответа: ${error.message}`, {
      status: response?.status,
      content_type: response?.headers?.get('Content-Type') || 'unknown',
    });
  }

  /**
   * Создает ошибку для неожиданных HTTP-статусов
   * @static
   * @param {Response} response - Объект HTTP-ответа
   * @returns {BitrixApiError} Экземпляр ошибки неожиданного статуса
   */
  static unexpectedStatus(response) {
    return new BitrixApiError('unexpected_status', `Неожиданный статус ответа: ${response.status}`, {
      status: response.status,
    });
  }
}

module.exports = BitrixApiError;
