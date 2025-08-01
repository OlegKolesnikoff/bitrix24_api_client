const { fetch } = require('undici');
const BitrixApiError = require('./bitrixErrors');

/**
 * Внутренний метод для обработки fetch-запроса.
 * @param {string} url - URL запроса.
 * @param {Object} params - Параметры fetch.
 * @param {Object} [options={}] - Дополнительные параметры запроса
 * @param {number} [options.tryes=5] - Максимальное количество попыток
 * @param {number} [options.remainingTryes] - Оставшиеся попытки
 * @param {number} [options.pause=3000] - Базовая задержка между попытками
 * @param {number} [options.abortTimeout] - Таймаут запроса в мс
 * @param {Object} [options.logger] - Объект логгера
 * @param {string} [options.requestId] - Идентификатор запроса
 * @param {Object} [options.logContext={}] - Контекст для логирования
 * @returns {Promise<Object>} Ответ от Bitrix24 или объект ошибки.
 */
async function bitrixFetch(url, params, options = {}) {
  options.requestId ||= generateRequestId();
  if (options.remainingTryes === undefined) options.remainingTryes = options.tryes;
  options.remainingTryes -= 1;

  const { abortTimeout = 15000, logger, requestId, logContext = {} } = options;

  const startTime = Date.now();

  try {
    // Логируем начало запроса
    logger.info(`Отправка запроса: #${requestId}`, {
      url,
      ...params,
      ...logContext,
      requestId,
    });

    params.signal = AbortSignal.timeout(abortTimeout);

    const response = await fetch(url, params);
    const responseTime = Date.now() - startTime;

    // Определяем группу статуса для использования в switch
    const statusGroup = Math.floor(response.status / 100);

    switch (statusGroup) {
      case 2:
        // Обработка успешных ответов // 200-299
        return await handleSuccessResponse(response, url, responseTime, options);

      case 3: // 300-399
        // Обработка редиректов
        return await handleRedirect(response, url, params, options);

      case 4: // 400-499
        // Обработка клиентских ошибок
        return await handleClientError(response, url, options);

      case 5: // 500-599
        // Обработка серверных ошибок
        return await handleServerError(response, url, params, options);

      default:
        // Обработка неожиданных статусов
        logger.error(`Запрос #${requestId} получил неожиданный статус ${response.status}`, {
          url,
          requestId,
        });
        return BitrixApiError.unexpectedStatus(response);
    }
  } catch (error) {
    return await handleFetchError(error, url, params, options);
  }
}

/**
 * Обрабатывает успешные ответы (2xx)
 * @param {Response} response - Объект ответа fetch
 * @param {string} url - URL запроса
 * @param {number} responseTime - Время выполнения запроса в мс
 * @param {Object} [options={}] - Опции запроса
 */
async function handleSuccessResponse(response, url, responseTime, options) {
  const { logger, requestId, logContext } = options;

  const result = await parseResponse(response);

  // Логируем информацию о полученном ответе
  logger.info(`Запрос #${requestId} получил ответ за: ${responseTime}ms`, {
    url,
    responseTime,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    requestId,
    body: result,
    ...logContext,
  });

  return result;
}

/**
 * Обрабатывает редиректы в ответе
 * @param {Response} response - Объект ответа fetch
 * @param {string} url - URL запроса
 * @param {Object} params - Параметры запроса
 * @param {Object} options - Опции запроса
 * @returns {Promise<Object>} Результат обработки редиректа
 */
async function handleRedirect(response, url, params, options) {
  const { tryes, remainingTryes, logger, requestId, logContext } = options;
  const newUrl = response.headers.get('location');
  const body = await parseResponse(response);

  logger.debug(`Запрос #${requestId} получил редирект: ${response.status}`, {
    url,
    location: newUrl,
    requestId,
    ...logContext,
    body,
    remainingTryes,
  });

  if (!newUrl) {
    const redirectError = BitrixApiError.redirect(
      response,
      `Получен код редиректа ${response.status}, но отсутствует заголовок Location`,
      body
    );
    logger.error(`Запрос #${requestId} ошибка редиректа: ${redirectError.message}`, {
      url,
      location: newUrl,
      requestId,
      ...logContext,
      ...redirectError,
      remainingTryes,
    });
    return redirectError;
  }

  if (remainingTryes <= 0) {
    const redirectError = BitrixApiError.redirect(response, `Превышено количество попыток редиректа ${tryes}`, body);
    logger.error(`Запрос #${requestId} ошибка редиректа: ${redirectError.message}`, {
      url,
      location: newUrl,
      requestId,
      ...logContext,
      ...redirectError,
      remainingTryes,
    });
    return redirectError;
  }

  return await bitrixFetch(newUrl, params, options);
}

/**
 * Обрабатывает клиентские ошибки (4xx)
 * @param {Response} response - Объект ответа fetch
 * @param {string} url - URL запроса
 * @param {Object} options - Опции запроса
 * @param {Object} options.logger - Объект логгера
 * @param {string} options.requestId - Идентификатор запроса
 * @param {Object} options.logContext - Контекст для логирования
 * @returns {Promise<Object>} Объект с информацией об ошибке
 */
async function handleClientError(response, url, options) {
  const { logger, requestId, logContext } = options;
  const errorData = await parseResponse(response);

  // Особая обработка истекшего токена
  if (errorData.error === 'expired_token') {
    return errorData;
  }

  // Стандартная обработка ошибок клиента
  const clientError = BitrixApiError.client(response, errorData);
  logger.warn(`Запрос #${requestId} ошибка клиента: ${clientError.error_bitrix_name || clientError.error}`, {
    url,
    requestId,
    ...logContext,
    ...clientError,
  });

  return clientError;
}

/**
 * Обрабатывает ошибки сервера (5xx)
 * @param {Response} response - Объект ответа fetch
 * @param {string} url - URL запроса
 * @param {Object} params - Параметры запроса
 * @param {Object} options - Опции запроса
 * @param {number} options.pause - Базовая задержка между попытками
 * @param {number} options.tryes - Максимальное количество попыток
 * @param {number} options.remainingTryes - Оставшиеся попытки
 * @param {string} options.requestId - Идентификатор запроса
 * @param {Object} options.logContext - Контекст для логирования
 * @param {Object} options.logger - Объект логгера
 * @returns {Promise<Object>} Результат обработки ошибки сервера или повторного запроса
 */
async function handleServerError(response, url, params, options) {
  const { pause, tryes, remainingTryes, requestId, logContext = {}, logger } = options;
  const errorData = await parseResponse(response);

  if (remainingTryes > 0) {
    logger.warn(
      `Запрос #${requestId} ошибка сервера: ${
        errorData?.error || response.statusText
      } осталось попыток ${remainingTryes}`,
      {
        url,
        remainingTryes,
        requestId,
        ...logContext,
        body: errorData,
      }
    );
    // если есть попытки, делаем паузу и повторяем запрос
    await waitExponentialBackoff(pause, tryes - remainingTryes);
    return await bitrixFetch(url, params, options);
  }

  const serverError = BitrixApiError.server(response, errorData);
  logger.error(
    `Запрос #${requestId} ошибка сервера: ${serverError.error_bitrix_name || serverError.error}, после всех попыток`,
    {
      url,
      requestId,
      ...logContext,
      ...serverError,
      remainingTryes,
    }
  );
  return serverError;
}

/**
 * Обрабатывает ошибки при выполнении fetch-запроса
 * @param {Error} error - Объект ошибки
 * @param {string} url - URL запроса
 * @param {Object} params - Параметры запроса
 * @param {Object} options - Опции запроса
 * @param {number} options.remainingTryes - Оставшиеся попытки
 * @param {number} options.abortTimeout - Таймаут запроса в мс
 * @param {number} options.tryes - Максимальное количество попыток
 * @param {number} options.pause - Базовая задержка между попытками
 * @param {Object} options.logger - Объект логгера
 * @param {string} options.requestId - Идентификатор запроса
 * @returns {Promise<Object>} Результат обработки ошибки или повторного запроса
 */
async function handleFetchError(error, url, params, options) {
  const { remainingTryes, abortTimeout, tryes, pause, logger, requestId, logContext } = options;
  // Проверяем, является ли ошибка определенно или возможно повторяемой
  if (isRetryable(error)) {
    const networkError = BitrixApiError.network(error, remainingTryes <= 0);
    // Проверяем, остались ли попытки
    if (remainingTryes > 0) {
      // Делаем паузу с экспоненциальным увеличением
      await waitExponentialBackoff(pause, tryes - remainingTryes);
      logger.warn(`Запрос #${requestId} ошибка сети: ${error.message}, осталось попыток ${remainingTryes}`, {
        ...networkError,
        url,
        remainingTryes,
        requestId,
        ...logContext,
        abortTimeout,
      });

      // Повторяем запрос
      return await bitrixFetch(url, params, options);
    } else {
      logger.error(`Запрос #${requestId} ошибка сети: ${error.message}, после всех попыток`, {
        ...networkError,
        url,
        remainingTryes,
        requestId,
        ...logContext,
        abortTimeout,
      });
      return networkError;
    }
  }

  // Если нет попыток или ошибка не подлежит повторной попытке
  logger.error(`Запрос #${requestId} завершился с неустранимой ошибкой: ${error.name} ${error.message}`, {
    url,
    requestId,
    ...logContext,
    original_error: error,
    remainingTryes,
  });

  return error;
}

/**
 * Разбирает ответ сервера и преобразует его в JSON
 * @param {Response} response - Объект ответа fetch
 * @returns {Promise<Object>} Распарсенный ответ или объект ошибки
 */
async function parseResponse(response) {
  // Получаем тип контента из заголовков
  const contentType = response.headers.get('Content-Type') || '';

  try {
    // Если это JSON
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    // Если это текст или HTML
    if (contentType.includes('text/plain') || contentType.includes('text/html')) {
      const text = await response.text();

      // Сначала пробуем распарсить как JSON (иногда сервер отдаёт JSON с неверным Content-Type)
      try {
        return JSON.parse(text);
      } catch {
        // Если не получилось, возвращаем как текст
        return {
          content: text,
          format: contentType.includes('text/html') ? 'html' : 'text',
        };
      }
    }

    // Если нет данных или пустой ответ
    if (contentType === '' || response.status === 204) {
      return {
        ok: response.ok,
      };
    }

    // Для всех остальных типов контента
    const rawContent = await response.text();

    // Пытаемся распарсить как JSON (на всякий случай)
    try {
      return JSON.parse(rawContent);
    } catch {
      return {
        content: rawContent,
        format: contentType.split(';')[0],
      };
    }
  } catch (error) {
    return BitrixApiError.parseError(error, response);
  }
}

/**
 * Проверяет, является ли ошибка определенно повторяемой
 * @param {Error} error - Объект ошибки
 * @returns {boolean} true если ошибка определенно повторяемая
 */
function isRetryable(error) {
  return (
    error.code === 'ECONNRESET' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ENETUNREACH' ||
    error.code === 'EPIPE' ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ENOTFOUND' ||
    error.code === 'ECONNREFUSED' ||
    /timeout|connection reset/i.test(error.message)
  );
}

/**
 * Ожидает экспоненциально увеличивающуюся паузу
 * @param {number} baseDelay - Базовая задержка в мс
 * @param {number} attempt - Номер текущей попытки (0-based)
 * @returns {Promise<number>} Promise, разрешающийся после паузы
 */
async function waitExponentialBackoff(baseDelay, attempt) {
  if (!baseDelay) return 0;

  // Используем битовый сдвиг для более быстрого возведения в степень
  const exponentialPause = baseDelay * (1 << attempt);
  // Добавляем случайный джиттер для предотвращения синхронизированных попыток
  const jitter = Math.random() * 0.3 * exponentialPause;
  const totalDelay = Math.floor(exponentialPause + jitter);

  await new Promise((resolve) => setTimeout(resolve, totalDelay));
  return totalDelay;
}

/**
 * Генерирует уникальный ID запроса
 * @returns {string} Уникальный ID
 */
function generateRequestId() {
  return Math.random().toString(36).substring(2, 10);
}

module.exports = bitrixFetch;
