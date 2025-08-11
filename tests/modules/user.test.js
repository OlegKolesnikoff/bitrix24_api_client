/**
 * Базовые тесты API
 */

module.exports = {
  // Тест аутентификации и получения текущего пользователя
  'должен получить текущего пользователя': async (api, auth, assert) => {
    const result = await api.call('user.current', {}, auth);
    assert.ok(result.result, 'Отсутствует поле result в ответе');
    assert.ok(result.result.ID, 'Отсутствует ID пользователя');
    assert.ok(result.result.NAME, 'Отсутствует имя пользователя');
  },

  // Тест обработки ошибок несуществующих методов
  'должен обрабатывать ошибки несуществующих методов': async (api, auth, assert) => {
    const result = await api.call('non.existent.method', {}, auth);
    assert.ok(result.error, 'Ожидалась ошибка, но поле error отсутствует');
  }
};
