const fs = require('fs');

/* Чтение авторизации */
async function readAuth() {
  const readSettings = fs.readFileSync('./tests/auth.json', 'utf8');
  return JSON.parse(readSettings);
}

async function writeAuth(appSettings) {
  fs.writeFileSync('./tests/auth.json', JSON.stringify(appSettings));
  return true;
}

module.exports = {
  readAuth,
  writeAuth,
};
