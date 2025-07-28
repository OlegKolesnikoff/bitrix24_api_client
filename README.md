# bitrix24_api_client

bitrix24_api_client — небольшой SDK для использования REST API Битрикс24 в приложениях

# Содержание

1. [Описание и функционал](#introduction)
2. [Подключение и настройка](#install)
3. [Настройка для тиражного приложения](#public)
4. [Установка приложения](#install)
5. [Добавление логера](#logger)
6. [Повторные запросы](#try)
7. [Чего не хватает](#need)

## <div id="introduction"></div>Описание

<ul>
<li>Вызов методов REST API Битрикс24
<li>Установка тиражного приложения
<li>Продление авторизации по протоколу OAuth 2.0
<li>Обработка перенаправлений, при смене адреса портала
<li>Не имеет зависимостей, все запросы выполняются через встроенный в Node.js Fetch, поэтому минимальная версия Node.js - 18

## <div id="install"></div>Подключение и настройка

Настройка для локального приложения или для теста, работа в рамках одного портала

```javascript
const BX24 = require('bitrix24_nodejs_sdk');

BX24.params = {
  C_REST_CLIENT_ID: // ...OAuth 2.0 client_id,
  C_REST_CLIENT_SECRET: // ...OAuth 2.0 client_secret
  authPath: './settings.json' // файл откуда будет считываться и записываться авторизация
};
```

Cодержимое settings.json:

```javascript
{
    "access_token": "...",
    "expires_in": 3600,
    "domain": "domain.bitrix24.ru",
    "status": "F",
    "client_endpoint": "https://domain.bitrix24.ru/rest/",
    "member_id": "...",
    "refresh_token": "...",
    "application_token": "...",
    "expires": 1728301329
  }
```

Вызов метода REST API Битрикс24

```javascript
...

const params = {
  order: { DATE_CREATE: 'ASC' },
  filter: { TYPE_ID: 'CLIENT' },
  select: ['ID', 'NAME', 'LAST_NAME', 'TYPE_ID', 'SOURCE_ID']
};

BX24.call('crm.contact.list', params)
  .then((response) => console.log(response))
  .catch((error) => console.error(error));
```

## <div id="local"></div>Настройка для тиражного приложения

```javascript
const BX24 = require('bitrix24_nodejs_sdk');

BX24.params = {
  C_REST_CLIENT_ID: // ...OAuth 2.0 client_id,
  C_REST_CLIENT_SECRET: // ...OAuth 2.0 client_secret
  getAuthHandler: getSettingData, // асинхронная функция получения авторизации
  setAuthHandler: setSettingsData, // асинхронная функция записи авторизации
};

async function getSettingData(appSettings) {
 // чтение авторизационных данных из БД
}

async function setSettingsData(appSettings) {
 // запись авторизационных данных в БД
}

// пример вызова метода
const auth = {
    "access_token": "...",
    "expires_in": 3600,
    "domain": "domain.bitrix24.ru",
    "status": "F",
    "client_endpoint": "https://domain.bitrix24.ru/rest/",
    "member_id": "...",
    "refresh_token": "...",
    "application_token": "...",
    "expires": 1728301329
  }

const params = {
  order: { DATE_CREATE: 'ASC' },
  filter: { TYPE_ID: 'CLIENT' },
  select: ['ID', 'NAME', 'LAST_NAME', 'TYPE_ID', 'SOURCE_ID']
};

BX24.call('crm.contact.list', params, auth)
  .then((response) => console.log(response))
  .catch((error) => console.error(error));

```

## <div id="install"></div>Установка тиражного приложения, на примере express.js

```javascript
const express = require('express');
const router = express.Router();
const path = require('path');
const BX24 = require('../bitrix/cRest');

// /install - путь указанный в кабинете разработчика, как путь установки

// установка приложения с интерфейсом
router.route('/install').post(async function (req, res, next) {
    try {
        if (req.query.DOMAIN) req.body['DOMAIN'] = req.query.DOMAIN;
        if (req.query.APP_SID) req.body['APP_SID'] = req.query.APP_SID;
        // метод возвращает актуальные авторизационные данные
        const auth = await BX24.installApp(req.body);

        /* index.html, который должен содержать
        <script src="//api.bitrix24.com/api/v1/"></script>
        <script>
        BX24.init(function () {
            BX24.installFinish();
        });
        </script> */
        res.sendFile(path.join(__dirname, 'index.html' ));
    } catch (err) {
        next(err);
    }
});

// установка приложения без интерфейса
router.route('/install').post(async function (req, res, next) {
    try {
        // метод возвращает актуальные авторизационные данные
        const auth = await BX24.installApp(req.body);
        res.staus(200).end();
    } catch (err) {
        next(err);
    }
});
```

## <div id="logger"></div>Логирование запросов и ответов

Если нужно логировать запросы и ответы, это можно сделать через декоратор

```javascript

// логирование запросов
const BX24 = require('bitrix24_nodejs_sdk');

function addLogging(fn) {
  return async function(method, params, auth) {
    const result = await fn.call(BX24, method, params, auth);
    // тут можно добавить логгер, который Вы используете
    console.log({ method, params, result });
    return result;
  }
}

BX24.call = addLogging(BX24.call);
module.exports = BX24;
```

## <div id="try"></div>Повторные запросы

Если нужно добавить логику повторных запросов, это можно сделать через декоратор

```javascript

// логирование запросов
const BX24 = require('bitrix24_nodejs_sdk');

// определяем попытки и повторные запросы
function addTrying(fn) {
  return async function(method, params, auth, tryes = 3, pause = 3000) {
    const result = await fn.call(BX24,method, params, auth);
    if (result.error) {
      if (tryes > 0) {
        if (Number.isInteger(tryes)) tryes--;
        await new Promise((r) => setTimeout(r, pause));
        return addTrying(fn);
      }
      return result;
    }
    return result;
  }
}

BX24.call = addTrying(BX24.call);
module.exports = BX24;
```

## <div id="need"></div>Чего в этом модуле нет...

<ul>
<li>метода batch
<li>AbortController для обрывания зависших запросов
<li>Возможно, логику повторных запросов, стоит добавить в сам модуль
