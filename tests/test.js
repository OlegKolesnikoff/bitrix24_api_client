/* eslint-disable n/no-process-exit */
/* eslint-disable n/no-unpublished-require */
/**
 * Запускает тесты Bitrix24API с реальными запросами
 * 
 * Использование:
 * node run-tests.js [модуль] [тест]
 * 
 * Примеры:
 * node run-tests.js                     - запуск всех тестов
 * node run-tests.js basic               - запуск всех базовых тестов
 * node run-tests.js limits              - запуск тестов лимитов
 * node run-tests.js crm lead           - запуск тестов CRM Lead
 */

const fs = require('fs');
const path = require('path');
const { logInfo, logSuccess, logError, logHeader, runSingleTest } = require('./test-helpers');

// Настройка API клиента
const Bitrix24API = require('../index.js');
const auth = require('./auth.json');
const keys = require('./keys.json');

Bitrix24API.config.client_id = keys.client_id;
Bitrix24API.config.client_secret = keys.client_secret;

// Настройка логирования
Bitrix24API.configureLogger({
  level: 'warn', // Для тестов используем уровень warn, чтобы не засорять вывод
  enabled: true,
});

// Аргументы командной строки
const args = process.argv.slice(2);
const moduleArg = args[0] || 'all';
const testArg = args[1];

// Директория с тестами
const testsDir = path.join(__dirname, 'modules');

// Поиск и запуск тестов
async function runTests() {
  logHeader('BITRIX24API ТЕСТЫ');
  logInfo(`Портал: ${auth.domain}`);
  
  // Получаем список доступных модулей тестов
  const modules = fs.readdirSync(testsDir)
    .filter(file => file.endsWith('.js'))
    .map(file => file.replace('.js', ''));
  
  // Фильтруем модули по аргументу
  const modulesToRun = moduleArg === 'all' 
    ? modules 
    : modules.filter(m => m.includes(moduleArg));
  
  if (modulesToRun.length === 0) {
    logError(`Модуль "${moduleArg}" не найден. Доступные модули: ${modules.join(', ')}`);
    process.exit(1);
  }
  
  // Статистика
  const stats = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    startTime: Date.now()
  };
  
  // Запускаем тесты для каждого выбранного модуля
  for (const moduleName of modulesToRun) {
    const modulePath = path.join(testsDir, `${moduleName}.js`);
    logInfo(`\nЗапуск модуля: ${moduleName}`);
    
    try {
      const moduleTests = require(modulePath);
      
      // Фильтрация тестов по второму аргументу, если указан
      const testsToRun = testArg 
        ? Object.keys(moduleTests).filter(t => t.includes(testArg))
        : Object.keys(moduleTests);
      
      if (testsToRun.length === 0 && testArg) {
        logError(`Тест "${testArg}" не найден в модуле ${moduleName}`);
        stats.skipped += Object.keys(moduleTests).length;
        continue;
      }
      
      for (const testName of testsToRun) {
        stats.total++;
        const testResult = await runSingleTest(testName, moduleTests[testName], Bitrix24API, auth);
        stats[testResult ? 'passed' : 'failed']++;
      }
      
      // Пропускаем тесты, которые не соответствуют фильтру
      if (testArg) {
        stats.skipped += Object.keys(moduleTests).length - testsToRun.length;
      }
    } catch (error) {
      logError(`Ошибка при загрузке модуля ${moduleName}: ${error.message}`);
    }
  }
  
  // Вывод итоговой статистики
  const duration = (Date.now() - stats.startTime) / 1000;
  logHeader('\nРЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ');
  logInfo(`Всего тестов: ${stats.total}`);
  logSuccess(`Успешных: ${stats.passed}`);
  logError(`Провалено: ${stats.failed}`);
  logInfo(`Пропущено: ${stats.skipped}`);
  logInfo(`Время выполнения: ${duration.toFixed(2)} сек`);
  
  process.exit(stats.failed > 0 ? 1 : 0);
}

// Запускаем тесты
runTests().catch(error => {
  logError(`Критическая ошибка: ${error.message}`);
  process.exit(1);
});