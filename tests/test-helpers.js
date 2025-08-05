/* eslint-disable no-console */
const assert = require('assert');

// Цвета для вывода в консоль
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Выводит информационное сообщение
 * @param {string} message 
 */
function logInfo(message) {
  console.log(`${colors.cyan}${message}${colors.reset}`);
}

/**
 * Выводит сообщение об успехе
 * @param {string} message 
 */
function logSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

/**
 * Выводит сообщение об ошибке
 * @param {string} message 
 */
function logError(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

/**
 * Выводит заголовок
 * @param {string} message 
 */
function logHeader(message) {
  console.log(`\n${colors.magenta}${message}${colors.reset}`);
  console.log(`${colors.magenta}${'='.repeat(message.length)}${colors.reset}`);
}

/**
 * Запускает отдельный тест и обрабатывает результаты
 * @param {string} testName - Название теста
 * @param {Function} testFn - Функция теста
 * @param {Object} api - Экземпляр Bitrix24API
 * @param {Object} auth - Данные авторизации
 * @returns {boolean} Результат теста (true - успех, false - провал)
 */
async function runSingleTest(testName, testFn, api, auth) {
  process.stdout.write(`  Тест: ${testName} ... `);
  
  const startTime = Date.now();
  try {
    await testFn(api, auth, assert);
    const duration = Date.now() - startTime;
    console.log(`${colors.green}✓ OK${colors.reset} (${duration}ms)`);
    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`${colors.red}✗ FAIL${colors.reset} (${duration}ms)`);
    console.log(`    ${colors.red}${error.message}${colors.reset}`);
    
    // Выводим стек ошибки, если это не ошибка проверки assert
    if (!(error instanceof assert.AssertionError)) {
      console.log(`    ${colors.yellow}${error.stack.split('\n').slice(1).join('\n')}${colors.reset}`);
    }
    
    return false;
  }
}

module.exports = {
  logInfo,
  logSuccess,
  logError,
  logHeader,
  runSingleTest
};