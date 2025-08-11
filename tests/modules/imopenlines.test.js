/* eslint-disable no-console */
/**
 * Тесты API для работы с Открытыми линиями (imopenlines)
 */

module.exports = {
  // Тест на получение списка конфигураций открытых линий
  'должен получить список конфигураций открытых линий': async (api, auth, assert) => {
    const result = await api.call('imopenlines.config.list.get', {}, auth);
    assert.ok(result.result, 'Отсутствует поле result в ответе');
    assert.ok(Array.isArray(result.result), 'Результат должен быть массивом');

    // Сохраняем первую найденную линию для последующих тестов
    if (result.result.length > 0) {
      global.testOpenlineConfigId = result.result[0].ID;
      global.testOpenlineConfig = result.result[0];
      return result.result[0];
    } else {
      console.log('Внимание: На портале не найдено ни одной открытой линии');
    }
  },

  // Тест на получение конфигурации открытой линии
  'должен получить конфигурацию открытой линии': async (api, auth, assert) => {
    const configId = global.testOpenlineConfigId;

    // Пропускаем тест, если не найдено ни одной линии
    if (!configId) {
      console.log('Тест пропущен: на портале нет открытых линий');
      return null;
    }
    const result = await api.call(
      'imopenlines.config.get',
      {
        CONFIG_ID: configId,
      },
      auth
    );

    assert.ok(result.result, 'Отсутствует поле result в ответе');
    assert.equal(result.result.ID, configId, 'ID полученной конфигурации не совпадает');
    assert.ok(result.result.LINE_NAME, 'Отсутствует название линии для клиентов');

    // Сохраняем дополнительные данные о линии
    global.testOpenlineConfig = Object.assign({}, global.testOpenlineConfig, result.result);

    return result.result;
  },
};
