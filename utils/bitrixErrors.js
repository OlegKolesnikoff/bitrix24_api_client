/**
 * Класс для представления ошибок API Bitrix
 */
class BitrixApiError {
  /**
   * @param {string} type - Тип ошибки
   * @param {string} description - Описание ошибки
   * @param {Object} details - Дополнительные данные
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
   */
  static network(error, retriesExhausted) {
    return new BitrixApiError('network_error', `Сетевая ошибка: ${error.message}`, {
      original_error: error,
      retries_exhausted: retriesExhausted,
    });
  }

  /**
   * Создает ошибку уровня клиента (4xx)
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
   */
  static redirect(response, message, errorData) {
    return new BitrixApiError('redirect_error', message, { status: response.status, bitrix_error: errorData });
  }

  /**
   * Создает ошибку разбора ответа
   * @param {Error} error - Объект ошибки парсинга
   * @param {Response} response - Исходный ответ
   * @returns {Object} Объект ошибки
   */
  static parseError(error, response) {
    return new BitrixApiError('response_parse_error', `Ошибка при разборе ответа: ${error.message}`, {
      status: response?.status,
      content_type: response?.headers?.get('Content-Type') || 'unknown',
    });
  }

  /**
   * Создает ошибку для неожиданных HTTP-статусов
   * @param {Response} response - Объект ответа
   * @returns {Object} Объект ошибки
   */
  static unexpectedStatus(response) {
    return new BitrixApiError('unexpected_status', `Неожиданный статус ответа: ${response.status}`, {
      status: response.status,
    });
  }

}

module.exports = BitrixApiError;
