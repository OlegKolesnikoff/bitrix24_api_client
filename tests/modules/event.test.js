/**
 * Тесты для API работы с событиями Bitrix24
 */

module.exports = {
  // Тест подписки на событие
  'должен успешно подписаться на событие': async (api, auth, assert) => {
    // Создаем тестовый обработчик для события OnCrmDealAdd
    const result = await api.call('event.bind', {
      event: 'OnCrmDealAdd',
      handler: 'https://example.com/webhook/deal-handler'
    }, auth);
    
    assert.ok(result.result, 'Отсутствует поле result в ответе');
    assert.strictEqual(result.result, true, 'Подписка на событие не выполнена');
  },

  // Тест отписки от события
  'должен успешно отписаться от события': async (api, auth, assert) => {
    // Отписываемся от события OnCrmDealAdd
    const result = await api.call('event.unbind', {
      event: 'OnCrmDealAdd',
      handler: 'https://example.com/webhook/deal-handler'
    }, auth);

      assert.ok(result.result, 'Отсутствует поле result в ответе');
      assert.strictEqual(typeof result.result.count, 'number', 'Поле count отсутствует или не является числом');
      assert.ok(result.result.count >= 1, 'Ожидалось, что count будет 1 или больше');
      },

  // Тест получения списка обработчиков событий
  'должен получить список обработчиков события': async (api, auth, assert) => {
    const result = await api.call('event.get', {
      event: 'OnCrmDealAdd'
    }, auth);
    
    assert.ok(result.result !== undefined, 'Отсутствует поле result в ответе');
    assert.ok(Array.isArray(result.result), 'Результат не является массивом');
  },
  
  // Тест обработки ошибок при неверных параметрах
  'должен обрабатывать ошибки при неверных параметрах': async (api, auth, assert) => {
    // Вызов event.bind без обязательных параметров
    const result = await api.call('event.bind', {}, auth);
    
    assert.ok(result.error, 'Ожидалась ошибка, но поле error отсутствует');
  },
  
  // Тест для проверки полного цикла: подписка, проверка и отписка
  'должен выполнить полный цикл подписки и отписки': async (api, auth, assert) => {
    const testEvent = 'OnCrmDealAdd';
    const testHandler = 'https://example.com/webhook/task-handler';

   // Подписываемся на событие
    const bindResult = await api.call('event.bind', {
      event: testEvent,
      handler: testHandler
    }, auth);
    
    assert.strictEqual(bindResult.result, true, 'Не удалось подписаться на событие');
    
    // Получаем список обработчиков
    const getResult = await api.call('event.get', {
      event: testEvent
    }, auth);
    
    // Проверяем, что наш обработчик в списке
    const handlerExists = getResult.result.some(handler => handler.event.toLowerCase() === testEvent.toLowerCase());
    assert.ok(handlerExists, 'Обработчик не найден в списке подписок');
    
    // Отписываемся от события
    const unbindResult = await api.call('event.unbind', {
      event: testEvent,
      handler: testHandler
    }, auth);
    
    assert.ok(unbindResult.result.count >= 1, 'Ожидалось, что count будет 1 или больше');
  }
};