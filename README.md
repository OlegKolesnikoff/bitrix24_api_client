# bitrix24_api_client

bitrix24_api_client — SDK для использования REST API Битрикс24 в Node.js приложениях

# Содержание

1. [Описание и функционал](#introduction)
2. [Подключение и настройка](#install)
3. [Настройка для тиражного приложения](#public)
4. [Установка приложения](#install-app)
5. [Логирование](#logger)
6. [Повторные запросы и таймауты](#retry)
7. [Обработка ошибок](#errors)
8. [Примеры использования](#examples)

## <div id="introduction"></div>Описание

* Вызов методов REST API Битрикс24
* Установка тиражного приложения
* Продление авторизации по протоколу OAuth 2.0
* Обработка перенаправлений при смене адреса портала
* Автоматические повторные попытки с экспоненциальной задержкой
* Таймауты для предотвращения зависания запросов
* Детальное логирование с маскированием чувствительных данных
* Требуется Node.js 18+

## <div id="install"></div>Подключение и настройка

### Установка

```bash
npm install bitrix24_api_client
```

### Базовая настройка

```javascript
const Bitrix24API = require('bitrix24_api_client');
const winston = require('winston');

// Конфигурация клиента
Bitrix24API.config.client_id = 'your_app_client_id';
Bitrix24API.config.client_secret = 'your_app_client_secret';

// Настройки повторных запросов и таймаутов
Bitrix24API.config.requestOptions = {
  tryes: 3,               // Количество попыток
  pause: 1000,            // Базовая задержка между попытками (мс)
  abortTimeout: 15000,    // Таймаут запроса (мс)
};

const customLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'bitrix24.log' })
  ]
});

// Подключение пользовательского логгера
Bitrix24API.config.logger = customLogger;
// Настройки логирования
Bitrix24API.configureLogger({
  enabled: true,
  level: 'debug',         // 'debug', 'info', 'warn', 'error'
});

// Вызов метода API
const auth = require('./auth.json'); // Файл с данными авторизации
const result = await Bitrix24API.call('user.get', { ID: 1 }, auth);
console.log(result);
```

## <div id="public"></div>Настройка для тиражного приложения

Для работы с несколькими порталами требуется настроить обработчики сохранения и загрузки авторизационных данных:

```javascript
const Bitrix24API = require('bitrix24_api_client');
const db = require('./your-database-module');

Bitrix24API.config.client_id = 'your_app_client_id';
Bitrix24API.config.client_secret = 'your_app_client_secret';

// Обработчики авторизации для работы с БД
Bitrix24API.config.readAuth = async (auth) => {
  // Получение авторизации из БД для конкретного домена
  return await db.getAuthData(auth.domain);
};

Bitrix24API.config.writeAuth = async (authData) => {
  // Сохранение авторизации в БД
  return await db.saveAuthData(authData.domain, authData);
};

// Пример вызова метода для конкретного портала
const auth = { domain: 'client-portal.bitrix24.ru', access_token: ... };
const result = await Bitrix24API.call('crm.contact.list', {
  order: { DATE_CREATE: 'ASC' },
  filter: { TYPE_ID: 'CLIENT' },
  select: ['ID', 'NAME', 'LAST_NAME']
}, auth);
```

## <div id="install-app"></div>Установка тиражного приложения

```javascript
const express = require('express');
const router = express.Router();
const path = require('path');
const Bitrix24API = require('bitrix24_api_client');

// Обработчик установки приложения
router.post('/install', async (req, res, next) => {
  try {
    // Если параметры переданы в URL
    if (req.query.DOMAIN) req.body.DOMAIN = req.query.DOMAIN;
    if (req.query.APP_SID) req.body.APP_SID = req.query.APP_SID;
    
    // Установка приложения
    const auth = await Bitrix24API.installApp(req.body);
    
    // Возвращаем страницу завершения установки
    res.sendFile(path.join(__dirname, 'install-success.html'));
  } catch (err) {
    next(err);
  }
});
```

## <div id="logger"></div>Логирование

SDK имеет встроенную систему логирования с маскированием чувствительных данных:

```javascript
// Настройка встроенного логгера
Bitrix24API.configureLogger({
  enabled: true,          // Включение/выключение логирования
  level: 'info',          // Уровень логирования: 'debug', 'info', 'warn', 'error'
});

// Использование пользовательского логгера
const winston = require('winston');
const customLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'bitrix24.log' })
  ]
});

// Подключение пользовательского логгера
Bitrix24API.config.logger = customLogger;
```

### Формат логов

Логи содержат информацию о запросах в формате:
```
[Bitrix24API][domain.bitrix24.ru][method.name][HTTP_STATUS] Сообщение
```

Пример:
```
[Bitrix24API][newitera.bitrix24.ru][user.get][200] Запрос #abc123 получил ответ (245ms)
[Bitrix24API][newitera.bitrix24.ru][oauth.token][200] Запрос #def456 получил ответ (109ms)
```

## <div id="retry"></div>Повторные запросы и таймауты

SDK автоматически выполняет повторные запросы при сетевых ошибках и ошибках сервера:

```javascript
Bitrix24API.config.requestOptions = {
  tryes: 5,                  // Максимальное количество попыток
  pause: 1000,               // Базовая задержка между попытками (мс)
  abortTimeout: 30000,       // Таймаут запроса (мс)
};
```

### Алгоритм повторных попыток

- **Экспоненциальная задержка**: каждая следующая попытка увеличивает время ожидания
- **Джиттер**: добавление случайности для предотвращения синхронизированных запросов
- **Умное определение**: автоматическое определение, стоит ли повторять запрос

Повторные попытки выполняются для:
- Сетевых ошибок (ECONNRESET, ETIMEDOUT, ENOTFOUND и др.)
- Серверных ошибок (5xx статусы)
- Таймаутов запросов

## <div id="errors"></div>Обработка ошибок

SDK обеспечивает информативную обработку ошибок:

```javascript
try {
  const result = await Bitrix24API.call('user.get', { ID: 1 }, auth);
} catch (error) {
  if (error.error === 'expired_token') {
    // Токен истек (обрабатывается автоматически)
  } else if (error.error === 'network_error') {
    // Сетевая ошибка
    console.error(`Ошибка сети: ${error.error_description}`);
  } else if (error.error === 'client_error') {
    // Ошибка клиента (400-499)
    console.error(`Ошибка запроса: ${error.error_description}`);
  } else if (error.error === 'server_error') {
    // Ошибка сервера (500-599)
    console.error(`Ошибка сервера: ${error.error_description}`);
  }
}
```

### Типы ошибок

- `expired_token` - истекший токен (обновляется автоматически)
- `network_error` - сетевые проблемы
- `timeout_error` - превышение времени ожидания
- `client_error` - ошибки запроса (4xx)
- `server_error` - ошибки сервера (5xx)
- `redirect_error` - проблемы с перенаправлениями

## <div id="examples"></div>Примеры использования

### Получение информации о пользователе

```javascript
const auth = require('./auth.json');

const user = await Bitrix24API.call('user.get', { ID: 1 }, auth);
console.log(`Пользователь: ${user.result[0].NAME} ${user.result[0].LAST_NAME}`);
```

### Получение списка контактов

```javascript
const contacts = await Bitrix24API.call('crm.contact.list', {
  order: { DATE_CREATE: 'ASC' },
  filter: { TYPE_ID: 'CLIENT' },
  select: ['ID', 'NAME', 'LAST_NAME', 'EMAIL', 'PHONE']
}, auth);

contacts.result.forEach(contact => {
  console.log(`${contact.NAME} ${contact.LAST_NAME}: ${contact.EMAIL}`);
});
```

### Создание сделки

```javascript
const newDeal = await Bitrix24API.call('crm.deal.add', {
  fields: {
    TITLE: 'Новая сделка',
    TYPE_ID: 'SALE',
    STAGE_ID: 'NEW',
    CURRENCY_ID: 'RUB',
    OPPORTUNITY: 10000,
    CONTACT_ID: 42,
    ASSIGNED_BY_ID: 1
  }
}, auth);

console.log(`Создана сделка с ID: ${newDeal.result}`);
```

### Обновление элемента

```javascript
const result = await Bitrix24API.call('crm.deal.update', {
  id: 42,
  fields: {
    TITLE: 'Обновленная сделка',
    STAGE_ID: 'WON'
  }
}, auth);

if (result.result) {
  console.log('Сделка успешно обновлена');
}
```

### Работа с задачами

```javascript
// Создание задачи
const newTask = await Bitrix24API.call('tasks.task.add', {
  fields: {
    TITLE: 'Новая задача',
    DESCRIPTION: 'Описание задачи',
    RESPONSIBLE_ID: 1,
    DEADLINE: '2025-12-31T23:59:59+03:00'
  }
}, auth);

// Добавление комментария к задаче
const comment = await Bitrix24API.call('task.commentitem.add', {
  taskId: newTask.result.task.id,
  fields: {
    AUTHOR_ID: 1,
    POST_MESSAGE: 'Новый комментарий к задаче'
  }
}, auth);
```

### Структура файла auth.json

```json
{
  "access_token": "your_access_token_here",
  "refresh_token": "your_refresh_token_here", 
  "expires": 1753981392,
  "expires_in": 3600,
  "scope": "app",
  "domain": "your-portal.bitrix24.ru",
  "server_endpoint": "https://oauth.bitrix.info/rest/",
  "status": "S",
  "client_endpoint": "https://your-portal.bitrix24.ru/rest/",
  "member_id": "your_member_id",
  "user_id": 1
}
```

## Безопасность

SDK автоматически маскирует чувствительные данные в логах:
- Токены доступа (`access_token`, `refresh_token`)
- Секретные ключи (`client_secret`)
- Пароли и другие чувствительные параметры

Маскированные данные отображаются как `[REDACTED]` в логах и URL запросов.
