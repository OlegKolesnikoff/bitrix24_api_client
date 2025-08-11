/* eslint-disable require-atomic-updates */
/**
 * Тесты API для работы со сделками (crm.deal)
 */

module.exports = {
  // Тест на получение списка сделок
  'должен получить список сделок': async (api, auth, assert) => {
    const result = await api.call('crm.deal.list', {
      select: ['ID', 'TITLE', 'STAGE_ID', 'OPPORTUNITY', 'CURRENCY_ID'],
      filter: { '>=ID': 1 },
      order: { ID: 'DESC' },
      start: 0
    }, auth);
    
    assert.ok(result.result, 'Отсутствует поле result в ответе');
    assert.ok(Array.isArray(result.result), 'Результат должен быть массивом');
    assert.ok(result.total >= 0, 'Отсутствует корректное значение total');
  },

  // Тест на добавление новой сделки
  'должен создать новую сделку': async (api, auth, assert) => {
    const testDeal = {
      TITLE: `Тестовая сделка ${Date.now()}`,
      OPPORTUNITY: 15000,
      CURRENCY_ID: 'RUB',
      STAGE_ID: 'NEW',
      COMMENTS: 'Создано автоматическим тестом'
    };
    
    const result = await api.call('crm.deal.add', { fields: testDeal }, auth);
    
    assert.ok(result.result > 0, 'Не получен ID созданной сделки');
    
    // Сохраняем ID для использования в других тестах
    global.testDealId = result.result;
    return testDeal;
  },

  // Тест на получение сделки по ID
  'должен получить сделку по ID': async (api, auth, assert) => {
    // Используем ID сделки, созданной в предыдущем тесте
    const dealId = global.testDealId;
    assert.ok(dealId, 'ID тестовой сделки отсутствует, сначала выполните тест создания');
    
    const result = await api.call('crm.deal.get', { id: dealId }, auth);
    
    assert.ok(result.result, 'Отсутствует поле result в ответе');
    assert.equal(result.result.ID, dealId, 'ID полученной сделки не совпадает');
    assert.ok(result.result.TITLE, 'Отсутствует название сделки');
    assert.ok(result.result.OPPORTUNITY, 'Отсутствует сумма сделки');
    assert.ok(result.result.CURRENCY_ID, 'Отсутствует валюта сделки');
    
    return result.result;
  },

  // Тест на обновление сделки
  'должен обновить существующую сделку': async (api, auth, assert) => {
    const dealId = global.testDealId;
    assert.ok(dealId, 'ID тестовой сделки отсутствует, сначала выполните тест создания');
    
    const updatedFields = {
      TITLE: `Обновленная сделка ${Date.now()}`,
      OPPORTUNITY: 25000,
      COMMENTS: 'Обновлено автоматическим тестом'
    };
    
    const result = await api.call('crm.deal.update', {
      id: dealId,
      fields: updatedFields
    }, auth);
    
    assert.ok(result.result, 'Обновление сделки не выполнено');
    
    // Проверяем, что данные действительно обновились
    const checkResult = await api.call('crm.deal.get', { id: dealId }, auth);
    assert.equal(checkResult.result.TITLE, updatedFields.TITLE, 'Название сделки не обновилось');
    assert.equal(checkResult.result.OPPORTUNITY, updatedFields.OPPORTUNITY, 'Сумма сделки не обновилась');
    assert.equal(checkResult.result.COMMENTS, updatedFields.COMMENTS, 'Комментарий сделки не обновился');
  },

  // Тест на получение полей сделки
  'должен получить описание полей сделки': async (api, auth, assert) => {
    const result = await api.call('crm.deal.fields', {}, auth);
    
    assert.ok(result.result, 'Отсутствует поле result в ответе');
    assert.ok(result.result.ID, 'Отсутствует описание поля ID');
    assert.ok(result.result.TITLE, 'Отсутствует описание поля TITLE');
    assert.ok(result.result.STAGE_ID, 'Отсутствует описание поля STAGE_ID');
    assert.ok(result.result.OPPORTUNITY, 'Отсутствует описание поля OPPORTUNITY');
  },

  // Тест на получение стадий сделок
  'должен получить список стадий сделок': async (api, auth, assert) => {
    const result = await api.call('crm.dealcategory.stage.list', {}, auth);
    
    assert.ok(result.result, 'Отсутствует поле result в ответе');
    assert.ok(Array.isArray(result.result), 'Результат должен быть массивом');
    assert.ok(result.result.length > 0, 'Список стадий пуст');
  },

  // Тест на привязку контакта к сделке
  'должен привязать контакт к сделке': async (api, auth, assert) => {
    const dealId = global.testDealId;
    assert.ok(dealId, 'ID тестовой сделки отсутствует, сначала выполните тест создания');
    
    // Сначала создаем тестовый контакт
    const testContact = {
      NAME: 'Тестовый',
      LAST_NAME: 'Контакт для сделки',
      EMAIL: [{ VALUE: `test_deal_${Date.now()}@example.com`, VALUE_TYPE: 'WORK' }]
    };
    
    const contactResult = await api.call('crm.contact.add', { fields: testContact }, auth);
    assert.ok(contactResult.result > 0, 'Не удалось создать контакт для привязки к сделке');
    
    const contactId = contactResult.result;
    
    // Привязываем контакт к сделке
    const result = await api.call('crm.deal.contact.add', {
      id: dealId,
      fields: {
        CONTACT_ID: contactId
      }
    }, auth);
    
    assert.ok(result.result, 'Привязка контакта к сделке не выполнена');
    
    // Проверяем, что контакт действительно привязан
    const contactsResult = await api.call('crm.deal.contact.items.get', { id: dealId }, auth);
    assert.ok(Array.isArray(contactsResult.result), 'Список контактов должен быть массивом');
    assert.ok(contactsResult.result.some(item => item.CONTACT_ID == contactId), 'Контакт не найден в списке привязанных');
    
    // Сохраняем ID контакта для последующей очистки
    global.testContactForDealId = contactId;
  },

  // Тест на удаление сделки и очистку
  'должен удалить сделку и связанные данные': async (api, auth, assert) => {
    const dealId = global.testDealId;
    assert.ok(dealId, 'ID тестовой сделки отсутствует, сначала выполните тест создания');
    
    // Удаляем связанный контакт, если он был создан
    if (global.testContactForDealId) {
      const contactDeleteResult = await api.call('crm.contact.delete', { id: global.testContactForDealId }, auth);
      assert.ok(contactDeleteResult.result, 'Удаление связанного контакта не выполнено');
      global.testContactForDealId = null;
    }
    
    // Удаляем саму сделку
    const result = await api.call('crm.deal.delete', { id: dealId }, auth);
    
    assert.ok(result.result, 'Удаление сделки не выполнено');
    
    // Проверяем, что сделка действительно удалена
    const checkResult = await api.call('crm.deal.get', { id: dealId }, auth);
    assert.ok(checkResult.error, 'Сделка не была удалена');
    
    // Очищаем глобальную переменную
    global.testDealId = null;
  }
};