/* eslint-disable require-atomic-updates */
/**
 * Тесты API для работы с товарами и товарными позициями (crm.product)
 */

module.exports = {
  // Тест на добавление товара в каталог
  'должен добавить товар в каталог': async (api, auth, assert) => {
    const testProduct = {
      NAME: `Тестовый товар ${Date.now()}`,
      CURRENCY_ID: 'RUB',
      PRICE: 5000,
      DESCRIPTION: 'Описание тестового товара, созданного автоматическим тестом',
      ACTIVE: 'Y',
      MEASURE: 5, // шт
      VAT_ID: 1,  // НДС
      VAT_INCLUDED: 'Y'
    };
    
    const result = await api.call('crm.product.add', { fields: testProduct }, auth);
    
    assert.ok(result.result > 0, 'Не получен ID созданного товара');
    
    // Сохраняем ID для использования в других тестах
    global.testProductId = result.result;
    
    // Проверяем, что товар действительно создан
    const checkResult = await api.call('crm.product.get', { id: global.testProductId }, auth);
    assert.ok(checkResult.result, 'Отсутствует поле result в ответе');
    assert.equal(checkResult.result.NAME, testProduct.NAME, 'Название товара не совпадает');
    assert.equal(checkResult.result.PRICE, testProduct.PRICE, 'Цена товара не совпадает');
    
    return testProduct;
  },

  // Тест на создание тестового лида для работы с товарными позициями
  'должен создать тестовый лид для работы с товарными позициями': async (api, auth, assert) => {
    const testLead = {
      TITLE: `Тестовый лид для товарных позиций ${Date.now()}`,
      NAME: 'Имя',
      LAST_NAME: 'Фамилия',
      STATUS_ID: 'NEW',
      OPENED: 'Y'
    };
    
    const result = await api.call('crm.lead.add', { fields: testLead }, auth);
    
    assert.ok(result.result > 0, 'Не получен ID созданного лида');
    
    // Сохраняем ID для использования в других тестах
    global.testLeadForProductId = result.result;
    
    return result.result;
  },

  // Тест на создание тестовой сделки для работы с товарными позициями
  'должен создать тестовую сделку для работы с товарными позициями': async (api, auth, assert) => {
    const testDeal = {
      TITLE: `Тестовая сделка для товарных позиций ${Date.now()}`,
      STAGE_ID: 'NEW',
      OPENED: 'Y',
      CURRENCY_ID: 'RUB'
    };
    
    const result = await api.call('crm.deal.add', { fields: testDeal }, auth);
    
    assert.ok(result.result > 0, 'Не получен ID созданной сделки');
    
    // Сохраняем ID для использования в других тестах
    global.testDealForProductId = result.result;
    
    return result.result;
  },

  // Тест на добавление товарной позиции к лиду
  'должен добавить товарную позицию к лиду': async (api, auth, assert) => {
    const leadId = global.testLeadForProductId;
    const productId = global.testProductId;
    
    assert.ok(leadId, 'ID тестового лида отсутствует, сначала выполните тест создания лида');
    assert.ok(productId, 'ID тестового товара отсутствует, сначала выполните тест создания товара');
    
    // Получаем информацию о товаре
    const productInfo = await api.call('crm.product.get', { id: productId }, auth);
    
    const productRows = [{
      PRODUCT_ID: productId,
      PRICE: productInfo.result.PRICE,
      QUANTITY: 2,
      DISCOUNT_TYPE_ID: 1, // Фиксированная сумма
      DISCOUNT_SUM: 500
    }];
    
    const result = await api.call('crm.lead.productrows.set', {
      id: leadId,
      rows: productRows
    }, auth);
    
    assert.ok(result.result, 'Добавление товарной позиции к лиду не выполнено');
    
    // Проверяем, что товарная позиция действительно добавлена
    const checkResult = await api.call('crm.lead.productrows.get', { id: leadId }, auth);
    
    assert.ok(Array.isArray(checkResult.result), 'Список товарных позиций должен быть массивом');
    assert.ok(checkResult.result.length > 0, 'Список товарных позиций пуст');
    assert.ok(checkResult.result.some(row => row.PRODUCT_ID == productId), 'Товарная позиция не найдена');
    
    // Сохраняем строки товаров для последующих тестов
    global.leadProductRows = checkResult.result;
    
    return checkResult.result;
  },

  // Тест на добавление товарной позиции к сделке
  'должен добавить товарную позицию к сделке': async (api, auth, assert) => {
    const dealId = global.testDealForProductId;
    const productId = global.testProductId;
    
    assert.ok(dealId, 'ID тестовой сделки отсутствует, сначала выполните тест создания сделки');
    assert.ok(productId, 'ID тестового товара отсутствует, сначала выполните тест создания товара');
    
    // Получаем информацию о товаре
    const productInfo = await api.call('crm.product.get', { id: productId }, auth);
    
    const productRows = [{
      PRODUCT_ID: productId,
      PRICE: productInfo.result.PRICE,
      QUANTITY: 3,
      DISCOUNT_TYPE_ID: 2, // Процент
      DISCOUNT_RATE: 10
    }];
    
    const result = await api.call('crm.deal.productrows.set', {
      id: dealId,
      rows: productRows
    }, auth);
    
    assert.ok(result.result, 'Добавление товарной позиции к сделке не выполнено');
    
    // Проверяем, что товарная позиция действительно добавлена
    const checkResult = await api.call('crm.deal.productrows.get', { id: dealId }, auth);
    
    assert.ok(Array.isArray(checkResult.result), 'Список товарных позиций должен быть массивом');
    assert.ok(checkResult.result.length > 0, 'Список товарных позиций пуст');
    assert.ok(checkResult.result.some(row => row.PRODUCT_ID == productId), 'Товарная позиция не найдена');
    
    // Сохраняем строки товаров для последующих тестов
    global.dealProductRows = checkResult.result;
    
    return checkResult.result;
  },

  // Тест на удаление товарной позиции из лида
  'должен удалить товарную позицию из лида': async (api, auth, assert) => {
    const leadId = global.testLeadForProductId;
    
    assert.ok(leadId, 'ID тестового лида отсутствует, сначала выполните тест создания лида');
    assert.ok(global.leadProductRows, 'Список товарных позиций лида отсутствует');
    
    // Удаляем все товарные позиции
    const result = await api.call('crm.lead.productrows.set', {
      id: leadId,
      rows: [] // Пустой массив товарных позиций
    }, auth);
    
    assert.ok(result.result, 'Удаление товарных позиций лида не выполнено');
    
    // Проверяем, что товарные позиции действительно удалены
    const checkResult = await api.call('crm.lead.productrows.get', { id: leadId }, auth);
    
    assert.ok(Array.isArray(checkResult.result), 'Список товарных позиций должен быть массивом');
    assert.equal(checkResult.result.length, 0, 'Список товарных позиций не пуст');
  },

  // Тест на удаление товарной позиции из сделки
  'должен удалить товарную позицию из сделки': async (api, auth, assert) => {
    const dealId = global.testDealForProductId;
    
    assert.ok(dealId, 'ID тестовой сделки отсутствует, сначала выполните тест создания сделки');
    assert.ok(global.dealProductRows, 'Список товарных позиций сделки отсутствует');
    
    // Удаляем все товарные позиции
    const result = await api.call('crm.deal.productrows.set', {
      id: dealId,
      rows: [] // Пустой массив товарных позиций
    }, auth);
    
    assert.ok(result.result, 'Удаление товарных позиций сделки не выполнено');
    
    // Проверяем, что товарные позиции действительно удалены
    const checkResult = await api.call('crm.deal.productrows.get', { id: dealId }, auth);
    
    assert.ok(Array.isArray(checkResult.result), 'Список товарных позиций должен быть массивом');
    assert.equal(checkResult.result.length, 0, 'Список товарных позиций не пуст');
  },

  // Тест на удаление тестовых сущностей
  'должен удалить все тестовые сущности': async (api, auth, assert) => {
    // Удаляем тестовый лид
    if (global.testLeadForProductId) {
      const leadResult = await api.call('crm.lead.delete', { id: global.testLeadForProductId }, auth);
      assert.ok(leadResult.result, 'Удаление тестового лида не выполнено');
      global.testLeadForProductId = null;
    }
    
    // Удаляем тестовую сделку
    if (global.testDealForProductId) {
      const dealResult = await api.call('crm.deal.delete', { id: global.testDealForProductId }, auth);
      assert.ok(dealResult.result, 'Удаление тестовой сделки не выполнено');
      global.testDealForProductId = null;
    }
    
    // Удаляем тестовый товар
    if (global.testProductId) {
      const productResult = await api.call('crm.product.delete', { id: global.testProductId }, auth);
      assert.ok(productResult.result, 'Удаление тестового товара не выполнено');
      global.testProductId = null;
    }
    
    // Очищаем глобальные переменные
    global.leadProductRows = null;
    global.dealProductRows = null;
  }
};