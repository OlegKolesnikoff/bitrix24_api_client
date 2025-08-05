/**
 * Устанавливает приложение Bitrix24.
 * @param {Object} request - Данные запроса установки.
 * @param {string} [request.event] - Тип события установки (например, 'ONAPPINSTALL').
 * @param {Object} [request.auth] - Данные авторизации при установке без интерфейса.
 * @param {string} [request.PLACEMENT] - Тип размещения приложения.
 * @param {string} [request.AUTH_ID] - Токен доступа при установке с интерфейсом.
 * @param {number} [request.AUTH_EXPIRES] - Время истечения токена.
 * @param {string} [request.APP_SID] - Токен приложения.
 * @param {string} [request.REFRESH_ID] - Токен для обновления.
 * @param {string} [request.DOMAIN] - Домен портала Битрикс24.
 * @param {string} [request.member_id] - Идентификатор пользователя.
 * @param {string} [request.status] - Статус установки.
 * @param {Function} setAuthFunction - Функция для сохранения данных авторизации.
 * @returns {Promise<Object>} Результат установки приложения.
 */

const { defaultLogger: logger } = require('../utils/logFetch');

// Константы для типов событий и размещений
const EVENT_TYPES = {
  APP_INSTALL: 'ONAPPINSTALL'
};

const PLACEMENT_TYPES = {
  DEFAULT: 'DEFAULT'
};

/**
 * Создает объект авторизации из параметров запроса
 * @param {Object} params - Параметры запроса с интерфейсом
 * @returns {Object} Объект авторизации
 */
function createAuthObject(params) {
  const { AUTH_ID, AUTH_EXPIRES, APP_SID, REFRESH_ID, DOMAIN, member_id, status } = params;
  
  // Валидация обязательных параметров
  if (!AUTH_ID || !DOMAIN) {
    throw new Error('Отсутствуют обязательные параметры AUTH_ID или DOMAIN');
  }
  
  return {
    access_token: AUTH_ID,
    expires_in: parseInt(AUTH_EXPIRES, 10) || 3600, // Преобразование в число с дефолтным значением
    application_token: APP_SID,
    refresh_token: REFRESH_ID,
    domain: DOMAIN,
    client_endpoint: `https://${DOMAIN}/rest/`,
    member_id,
    status,
  };
}

async function installApp(request, setAuthFunction) {
  // Формируем контекст для логирования
  const logContext = {
    domain: request?.DOMAIN || request?.auth?.domain || 'unknown',
    apiMethod: 'installApp',
  };

  // Логируем начало установки, маскируя чувствительные данные
  logger.info('Начало установки приложения', {
    ...logContext,
    request: {
      ...request,
      auth: request.auth ? '***' : undefined,
      AUTH_ID: request.AUTH_ID ? '***' : undefined,
      REFRESH_ID: request.REFRESH_ID ? '***' : undefined
    }
  });

  try {
    // Валидация входных параметров
    if (!request || typeof request !== 'object') {
      throw new Error('Требуется объект request');
    }
    
    if (typeof setAuthFunction !== 'function') {
      throw new Error('Параметр setAuthFunction должен быть функцией');
    }
    
    const result = {
      rest_only: true,
      install: false,
    };
    const { event, auth, PLACEMENT } = request;

    // установка приложения без интерфейса
    if (event === EVENT_TYPES.APP_INSTALL && auth) {
      logger.info('Установка приложения без интерфейса', logContext);
      result.install = await setAuthFunction(auth, true);
      result.auth = auth;
      logger.info('Приложение установлено без интерфейса', {
        ...logContext,
        success: result.install
      });
      return result;
    }

    // установка приложения с интерфейсом, на странице приложения необходимо вызвать BX24.installFinish()
    if (PLACEMENT === PLACEMENT_TYPES.DEFAULT) {
      logger.info('Установка приложения с интерфейсом', logContext);
      
      try {
        const auth = createAuthObject(request);
        result.rest_only = false;
        result.auth = auth;
        result.install = await setAuthFunction(auth, true);
        logger.info('Приложение установлено с интерфейсом', {
          ...logContext,
          success: result.install
        });
        return result;
      } catch (authError) {
        logger.error('Ошибка при создании объекта auth', {
          ...logContext,
          error: authError
        });
        throw new Error(`Ошибка при создании объекта auth: ${authError.message}`);
      }
    }

    // Если не выполнилось ни одно из условий
    logger.warn('Установка не выполнена: не найдены подходящие параметры', logContext);
    result.description = 'Установка не выполнена: не найдены подходящие параметры';
    return result;

  } catch (err) {
    logger.error('Ошибка при установке приложения', {
      ...logContext,
      error: err
    });
    return {
      error: 'install_error',
      error_code: getErrorCode(err),
      description: `${err.name}: ${err.message}`,
      context: { 
        event: request?.event,
        placement: request?.PLACEMENT,
        domain: request?.DOMAIN || request?.auth?.domain 
      },
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    };
  }
}

// Вспомогательная функция для определения кодов ошибок
function getErrorCode(error) {
  if (error.message.includes('auth')) return 'auth_error';
  if (error.message.includes('domain')) return 'domain_error';
  if (error.message.includes('setAuthFunction')) return 'function_error';
  return 'unknown_error';
}

module.exports = installApp;
