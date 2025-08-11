/**
 * Тесты API для работы с контактами (crm.contact)
 */

module.exports = {
  // Тест на получение списка контактов
  'должен получить список контактов': async (api, auth, assert) => {
    const result = await api.call('crm.contact.list', {
      select: ['ID', 'NAME', 'LAST_NAME', 'EMAIL'],
      filter: { '>=ID': 1 },
      order: { ID: 'DESC' },
      start: 0
    }, auth);
    
    assert.ok(result.result, 'Отсутствует поле result в ответе');
    assert.ok(Array.isArray(result.result), 'Результат должен быть массивом');
    assert.ok(result.total >= 0, 'Отсутствует корректное значение total');
  },

  // Тест на добавление нового контакта
  'должен создать новый контакт': async (api, auth, assert) => {
    const testContact = {
      NAME: 'Тестовый',
      LAST_NAME: 'Контакт',
      EMAIL: [{ VALUE: `test_${Date.now()}@example.com`, VALUE_TYPE: 'WORK' }],
      PHONE: [{ VALUE: '+7123456789' + Math.floor(Math.random() * 10), VALUE_TYPE: 'WORK' }]
    };
    
    const result = await api.call('crm.contact.add', { fields: testContact }, auth);
    
    assert.ok(result.result > 0, 'Не получен ID созданного контакта');
    
    // Сохраняем ID для использования в других тестах
    global.testContactId = result.result;
    return testContact;
  },

  // Тест на получение контакта по ID
  'должен получить контакт по ID': async (api, auth, assert) => {
    // Используем ID контакта, созданного в предыдущем тесте
    const contactId = global.testContactId;
    assert.ok(contactId, 'ID тестового контакта отсутствует, сначала выполните тест создания');
    
    const result = await api.call('crm.contact.get', { id: contactId }, auth);
    
    assert.ok(result.result, 'Отсутствует поле result в ответе');
    assert.equal(result.result.ID, contactId, 'ID полученного контакта не совпадает');
    assert.ok(result.result.NAME, 'Отсутствует имя контакта');
    assert.ok(result.result.LAST_NAME, 'Отсутствует фамилия контакта');
    
    return result.result;
  },

  // Тест на обновление контакта
  'должен обновить существующий контакт': async (api, auth, assert) => {
    const contactId = global.testContactId;
    assert.ok(contactId, 'ID тестового контакта отсутствует, сначала выполните тест создания');
    
    const updatedFields = {
      NAME: 'Обновленный',
      COMMENTS: 'Тестовый комментарий ' + Date.now()
    };
    
    const result = await api.call('crm.contact.update', {
      id: contactId,
      fields: updatedFields
    }, auth);
    
    assert.ok(result.result, 'Обновление контакта не выполнено');
    
    // Проверяем, что данные действительно обновились
    const checkResult = await api.call('crm.contact.get', { id: contactId }, auth);
    assert.equal(checkResult.result.NAME, updatedFields.NAME, 'Имя контакта не обновилось');
    assert.equal(checkResult.result.COMMENTS, updatedFields.COMMENTS, 'Комментарий контакта не обновился');
  },

  // Тест на удаление контакта
  'должен удалить контакт': async (api, auth, assert) => {
    const contactId = global.testContactId;
    assert.ok(contactId, 'ID тестового контакта отсутствует, сначала выполните тест создания');
    
    const result = await api.call('crm.contact.delete', { id: contactId }, auth);
    
    assert.ok(result.result, 'Удаление контакта не выполнено');
    
    // Проверяем, что контакт действительно удален
    const checkResult = await api.call('crm.contact.get', { id: contactId }, auth);
    assert.ok(checkResult.error, 'Контакт не был удален');
    
    // Очищаем глобальную переменную
    // eslint-disable-next-line require-atomic-updates
    global.testContactId = null;
  }
};