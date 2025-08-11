/* eslint-disable require-atomic-updates */
/**
 * Тесты API для работы с лидами (crm.lead)
 */

module.exports = {
  // Тест на получение списка лидов
  'должен получить список лидов': async (api, auth, assert) => {
    const result = await api.call('crm.lead.list', {
      select: ['ID', 'TITLE', 'NAME', 'LAST_NAME', 'STATUS_ID', 'OPPORTUNITY'],
      filter: { '>=ID': 1 },
      order: { ID: 'DESC' },
      start: 0
    }, auth);
    
    assert.ok(result.result, 'Отсутствует поле result в ответе');
    assert.ok(Array.isArray(result.result), 'Результат должен быть массивом');
    assert.ok(result.total >= 0, 'Отсутствует корректное значение total');
  },

  // Тест на добавление нового лида
  'должен создать новый лид': async (api, auth, assert) => {
    const testLead = {
      TITLE: `Тестовый лид ${Date.now()}`,
      NAME: 'Имя',
      LAST_NAME: 'Фамилия',
      STATUS_ID: 'NEW',
      OPENED: 'Y',
      ASSIGNED_BY_ID: 1,
      OPPORTUNITY: 10000,
      CURRENCY_ID: 'RUB',
      PHONE: [{ VALUE: '+7999' + Math.floor(Math.random() * 10000000), VALUE_TYPE: 'WORK' }],
      EMAIL: [{ VALUE: `test_lead_${Date.now()}@example.com`, VALUE_TYPE: 'WORK' }],
      COMMENTS: 'Создано автоматическим тестом'
    };
    
    const result = await api.call('crm.lead.add', { fields: testLead }, auth);
    
    assert.ok(result.result > 0, 'Не получен ID созданного лида');
    
    // Сохраняем ID для использования в других тестах
    global.testLeadId = result.result;
    return testLead;
  },

  // Тест на получение лида по ID
  'должен получить лид по ID': async (api, auth, assert) => {
    // Используем ID лида, созданного в предыдущем тесте
    const leadId = global.testLeadId;
    assert.ok(leadId, 'ID тестового лида отсутствует, сначала выполните тест создания');
    
    const result = await api.call('crm.lead.get', { id: leadId }, auth);
    
    assert.ok(result.result, 'Отсутствует поле result в ответе');
    assert.equal(result.result.ID, leadId, 'ID полученного лида не совпадает');
    assert.ok(result.result.TITLE, 'Отсутствует название лида');
    assert.ok(result.result.NAME, 'Отсутствует имя контакта лида');
    assert.ok(result.result.STATUS_ID, 'Отсутствует статус лида');
    
    return result.result;
  },

  // Тест на обновление лида
  'должен обновить существующий лид': async (api, auth, assert) => {
    const leadId = global.testLeadId;
    assert.ok(leadId, 'ID тестового лида отсутствует, сначала выполните тест создания');
    
    const updatedFields = {
      TITLE: `Обновленный лид ${Date.now()}`,
      NAME: 'Новое имя',
      OPPORTUNITY: 15000,
      COMMENTS: 'Обновлено автоматическим тестом'
    };
    
    const result = await api.call('crm.lead.update', {
      id: leadId,
      fields: updatedFields
    }, auth);
    
    assert.ok(result.result, 'Обновление лида не выполнено');
    
    // Проверяем, что данные действительно обновились
    const checkResult = await api.call('crm.lead.get', { id: leadId }, auth);
    assert.equal(checkResult.result.TITLE, updatedFields.TITLE, 'Название лида не обновилось');
    assert.equal(checkResult.result.NAME, updatedFields.NAME, 'Имя контакта лида не обновилось');
    assert.equal(checkResult.result.OPPORTUNITY, updatedFields.OPPORTUNITY, 'Сумма лида не обновилась');
    assert.equal(checkResult.result.COMMENTS, updatedFields.COMMENTS, 'Комментарий лида не обновился');
  },

  // Тест на получение полей лида
  'должен получить описание полей лида': async (api, auth, assert) => {
    const result = await api.call('crm.lead.fields', {}, auth);
    
    assert.ok(result.result, 'Отсутствует поле result в ответе');
    assert.ok(result.result.ID, 'Отсутствует описание поля ID');
    assert.ok(result.result.TITLE, 'Отсутствует описание поля TITLE');
    assert.ok(result.result.NAME, 'Отсутствует описание поля NAME');
    assert.ok(result.result.STATUS_ID, 'Отсутствует описание поля STATUS_ID');
    assert.ok(result.result.OPPORTUNITY, 'Отсутствует описание поля OPPORTUNITY');
  },

  // Тест на получение статусов лидов
  'должен получить список статусов лидов': async (api, auth, assert) => {
    const result = await api.call('crm.status.list', {
      filter: { ENTITY_ID: 'STATUS' }
    }, auth);
    
    assert.ok(result.result, 'Отсутствует поле result в ответе');
    assert.ok(Array.isArray(result.result), 'Результат должен быть массивом');
    assert.ok(result.result.length > 0, 'Список статусов пуст');
    
    // Проверяем наличие основных статусов
    const statusIds = result.result.map(status => status.STATUS_ID);
    assert.ok(statusIds.includes('NEW'), 'Отсутствует статус NEW');
    assert.ok(statusIds.includes('IN_PROCESS'), 'Отсутствует статус IN_PROCESS');
    assert.ok(statusIds.includes('CONVERTED'), 'Отсутствует статус CONVERTED');
    assert.ok(statusIds.includes('JUNK'), 'Отсутствует статус JUNK');
  },

  // Тест на изменение статуса лида
  'должен изменить статус лида': async (api, auth, assert) => {
    const leadId = global.testLeadId;
    assert.ok(leadId, 'ID тестового лида отсутствует, сначала выполните тест создания');
    
    const result = await api.call('crm.lead.update', {
      id: leadId,
      fields: { STATUS_ID: 'IN_PROCESS' }
    }, auth);
    
    assert.ok(result.result, 'Изменение статуса лида не выполнено');
    
    // Проверяем, что статус действительно изменился
    const checkResult = await api.call('crm.lead.get', { id: leadId }, auth);
    assert.equal(checkResult.result.STATUS_ID, 'IN_PROCESS', 'Статус лида не изменился');
  },

  // Тест на добавление товаров к лиду
  'должен добавить товары к лиду': async (api, auth, assert) => {
    const leadId = global.testLeadId;
    assert.ok(leadId, 'ID тестового лида отсутствует, сначала выполните тест создания');
    
    const productRows = [
      {
        PRODUCT_NAME: 'Тестовый товар 1',
        PRICE: 5000,
        QUANTITY: 2
      },
      {
        PRODUCT_NAME: 'Тестовый товар 2',
        PRICE: 3000,
        QUANTITY: 1
      }
    ];
    
    const result = await api.call('crm.lead.productrows.set', {
      id: leadId,
      rows: productRows
    }, auth);
    
    assert.ok(result.result, 'Добавление товаров к лиду не выполнено');
    
    // Проверяем, что товары действительно добавлены
    const checkResult = await api.call('crm.lead.productrows.get', { id: leadId }, auth);
    assert.ok(Array.isArray(checkResult.result), 'Список товаров должен быть массивом');
    assert.equal(checkResult.result.length, 2, 'Количество товаров не соответствует добавленному');
  },

  // Тест на удаление лида
  'должен удалить лид': async (api, auth, assert) => {
    const leadId = global.testLeadId;
    assert.ok(leadId, 'ID тестового лида отсутствует, сначала выполните тест создания');
    
    const result = await api.call('crm.lead.delete', { id: leadId }, auth);
    
    assert.ok(result.result, 'Удаление лида не выполнено');
    
    // Проверяем, что лид действительно удален
    const checkResult = await api.call('crm.lead.get', { id: leadId }, auth);
    assert.ok(checkResult.error, 'Лид не был удален');
    
    // Очищаем глобальную переменную
    global.testLeadId = null;
  }
};