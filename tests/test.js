/* eslint-disable n/no-unpublished-require */
/* eslint-disable no-console */
const Bitrix24API = require('../index.js');
const auth = require('./auth.json');
const keys = require('./keys.json');

Bitrix24API.config.client_id = keys.client_id;
Bitrix24API.config.client_secret = keys.client_secret;

// Настройка логирования
Bitrix24API.configureLogger({
  level: 'debug', // показывать все логи
  enabled: true,
});

Bitrix24API.call('user.get', { filter: { ID: 6 } }, auth).catch((error) => {
  console.error('Error fetching user info:', error);
});
