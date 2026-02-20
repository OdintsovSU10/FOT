# Sigur Public REST API

> Версия ПО: 1.6.3.14 | Дата ревизии: 04.09.2024

## 1. Общее

- **Base URL:** `http://<SIGUR_IP>:9500/api/v1/`
- **Swagger:** `http://<SIGUR_IP>:9500/swagger`
- Все запросы (кроме auth) требуют заголовок `Authorization: Bearer <JWT>`
- `Content-Type: application/json` для POST/PUT/PATCH/DELETE с телом
- Максимум `limit` = 3000

## 2. Аутентификация

### Получение токена

```
POST /api/v1/users/auth
```

```json
{ "username": "string", "password": "string" }
```

**Ответ:**
```json
{
  "token": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresAt": "2023-12-03T17:38:59+03:00",
  "refreshExpiresAt": "2023-12-04T16:39:00+03:00"
}
```

- Токен действителен **1 час**
- Есть лимит активных сессий — при превышении старейший токен отзывается

### Обновление токена

```
POST /api/v1/jwt/refresh
Header: Authorization: Bearer <JWT>
Body: "<refreshToken>"
```

### Устаревший метод (deprecated)

```
POST /api/v1/application-keys/auth → использовать /users/auth
```

---

## 3. Общие query-параметры

Большинство GET-эндпоинтов поддерживают:

| Параметр | Описание |
|---|---|
| `id` | Фильтр по ID(s): `?id=1,2` или `?id=1&id=2` |
| `limit` | Кол-во записей (0–3000) |
| `offset` | Пропустить N записей |
| `sortBy` | Поле сортировки |
| `sortOrder` | `ASC` или `DESC` |
| `includeFields` | Только указанные поля в ответе |
| `excludeFields` | Все поля кроме указанных |
| `<custom_field>` | Фильтр по кастомному полю |

---

## 4. Departments (Отделы)

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/departments` | Список отделов |
| GET | `/departments/{id}` | Отдел по ID |
| POST | `/departments` | Создать (обяз: `name`) |
| PUT | `/departments/{id}` | Редактировать |
| DELETE | `/departments/{id}` | Удалить (нельзя если есть сотрудники/дочерние) |
| POST | `/departments/create` | Массовое создание |
| POST | `/departments/update` | Массовое обновление (обяз: `id`) |
| POST | `/departments/delete` | Массовое удаление, body: `[id, id]` |
| GET | `/departments/count` | Кол-во отделов |

**Доп. query-параметры GET:** `parentId` (0 = корневые), `name`

**Объект отдела:**
```json
{
  "id": 1,
  "parentId": 0,
  "name": "Head Department",
  "hasChildren": true,
  "description": "Main"
}
```

---

## 5. Positions (Должности)

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/positions` | Список |
| GET | `/positions/{id}` | По ID |
| POST | `/positions` | Создать (обяз: `name`) |
| PUT | `/positions/{id}` | Редактировать |
| DELETE | `/positions/{id}` | Удалить (нельзя если назначена сотруднику) |
| POST | `/positions/create` | Массовое создание |
| POST | `/positions/update` | Массовое обновление (обяз: `id`) |
| POST | `/positions/delete` | Массовое удаление, body: `[id, id]` |

**Объект:**
```json
{ "id": 1, "name": "Developer" }
```

---

## 6. Cards (Карты)

### Форматы карт

| Формат | Описание |
|---|---|
| `UID` | Raw UID, алгоритм: берутся N байт с начала, реверсируются |
| `MEMORY` | Блок памяти, берутся N байт с начала без реверса |
| `W26`, `W34`, `W36`, `W37`, `W42`, `W58`, `W58DEC` | Конкретный Wiegand формат |

> Эндпоинты Cards **не работают** с QR-кодами посетителей.

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/cards` | Список карт |
| GET | `/cards/{id}` | Карта по ID |
| POST | `/cards` | Создать (обяз: `value`, `format`) |
| PUT | `/cards/{id}` | Редактировать (только `name` и кастомные поля) |
| DELETE | `/cards/{id}` | Удалить |
| POST | `/cards/create` | Массовое создание |
| POST | `/cards/update` | Массовое обновление (обяз: `id`) |
| POST | `/cards/delete` | Массовое удаление, body: `[id, id]` |

**Доп. query-параметры GET:** `issued`, `name`, `value`, `search`, `guestApplicable`, `excludeLegacyGuests`

**Объект карты:**
```json
{
  "id": 1,
  "name": "Card 1",
  "value": "AABBCCDD",
  "formattedValue": "170,48076",
  "format": "W26",
  "holder": { "holderId": 10, "type": "EMP" },
  "guestApplicable": false
}
```

---

## 7. Employees (Сотрудники)

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/employees` | Список |
| GET | `/employees/{id}` | По ID (`?withFullPhoto=true`) |
| POST | `/employees` | Создать (обяз: `name`, `departmentId`) |
| PUT | `/employees/{id}` | Редактировать |
| DELETE | `/employees/{id}` | Удалить |
| PUT | `/employees/{id}/block` | Заблокировать → 204 |
| PUT | `/employees/{id}/unblock` | Разблокировать → 204 |
| POST | `/employees/create` | Массовое создание |
| POST | `/employees/update` | Массовое обновление (обяз: `id`) |
| POST | `/employees/delete` | Массовое удаление, body: `[id, id]` |
| POST | `/employees/block` | Массовая блокировка, body: `[id, id]` → 204 |
| POST | `/employees/unblock` | Массовая разблокировка, body: `[id, id]` → 204 |
| GET | `/employees/count` | Кол-во (`?groupBy=departmentName`) |

**Доп. query-параметры GET:** `departmentId`, `positionId`, `name`, `blocked`, `tabId[STARTS_WITH]`

**Объект сотрудника:**
```json
{
  "id": 1,
  "name": "Jack Noname",
  "departmentId": 2,
  "departmentName": "R&D",
  "positionId": 8,
  "positionName": "Developer",
  "vehicles": [{ "id": 1, "lpNumber": "d849kp" }],
  "photo": "/9j/4AAQSkZJRgABA...",
  "contactDetails": [
    { "type": "TELEGRAM", "value": "@user", "preferable": true }
  ],
  "isBlocked": false,
  "description": "",
  "tabId": "12345",
  "location": {
    "zoneId": 1,
    "zoneName": "Zone A",
    "entranceTime": "2024-01-01T08:00:00"
  }
}
```

**contactDetails.type:** `SMS`, `VIBER`, `TELEGRAM`, `EMAIL`

### Транспорт сотрудника (deprecated)

Используйте кастомные поля вместо этих эндпоинтов:

| Метод | Endpoint |
|---|---|
| POST | `/employees/{id}/vehicles` |
| PUT | `/employees/{id}/vehicles/{vehicleId}` |
| DELETE | `/employees/{id}/vehicles/{vehicleId}` |

---

## 8. Official Vehicles (Служебный транспорт)

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/vehicles/official` | Список |
| GET | `/vehicles/official/{id}` | По ID |
| POST | `/vehicles/official` | Создать (обяз: `lpNumber`) |
| PUT | `/vehicles/official/{id}` | Редактировать |
| DELETE | `/vehicles/official/{id}` | Удалить |
| POST | `/vehicles/official/create` | Массовое создание |
| POST | `/vehicles/official/update` | Массовое обновление (обяз: `id`) |
| POST | `/vehicles/official/delete` | Массовое удаление, body: `[id, id]` |

**Доп. query-параметры GET:** `departmentId`, `lpNumber`

---

## 9. Bindings (Привязки)

### Employees ↔ Cards

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/bindings/employees-cards` | Список привязок |
| POST | `/bindings/employees-cards` | Назначить (обяз: `employeeId`, `cardId`, `format`) |
| PUT | `/bindings/employees-cards` | Обновить срок действия (обяз: `employeeId`, `cardId`, `expirationDate`) |
| PATCH | `/bindings/employees-cards` | Обновить start+expiration (обяз: `employeeId`, `cardId`, `startDate`, `expirationDate`) |
| POST | `/bindings/employees-cards/delete` | Удалить привязку (обяз: `employeeId`, `cardId`, `format`) |

**Объект:**
```json
{
  "employeeId": 1,
  "cardId": 1,
  "startDate": "2023-12-03T17:57:09.104Z",
  "expirationDate": "2023-12-03T17:57:09.104Z",
  "format": "W26"
}
```

### Employees ↔ Access Rules

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/bindings/employees-accessrules` | Список |
| POST | `/bindings/employees-accessrules` | Назначить (обяз: `employeeId`, `accessruleId`) |
| POST | `/bindings/employees-accessrules/delete` | Удалить |

### Employees ↔ Access Points

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/bindings/employees-accesspoints` | Список |
| POST | `/bindings/employees-accesspoints` | Создать (обяз: `employeeIds[]`, `accessPointIds[]`) |
| POST | `/bindings/employees-accesspoints/delete` | Удалить |

### Vehicles ↔ Cards

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/bindings/vehicles-cards` | Список |
| POST | `/bindings/vehicles-cards` | Назначить (обяз: `vehicleId`, `cardId`, `format`) |
| PUT | `/bindings/vehicles-cards` | Обновить срок (обяз: `vehicleId`, `cardId`, `expirationDate`) |
| POST | `/bindings/vehicles-cards/delete` | Удалить (обяз: `vehicleId`, `cardId`, `format`) |

### Vehicles ↔ Access Rules

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/bindings/vehicles-accessrules` | Список |
| POST | `/bindings/vehicles-accessrules` | Назначить (обяз: `vehicleId`, `accessruleId`) |
| POST | `/bindings/vehicles-accessrules/delete` | Удалить |

### Vehicles ↔ Access Points

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/bindings/vehicles-accesspoints` | Список |
| POST | `/bindings/vehicles-accesspoints` | Создать (обяз: `vehicleIds[]`, `accessPointIds[]`) |
| POST | `/bindings/vehicles-accesspoints/delete` | Удалить |

### Access Rules ↔ Access Points

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/bindings/accessrules-accesspoints` | Список |
| POST | `/bindings/accessrules-accesspoints` | Назначить (обяз: `accessruleId`, `accesspointId`) |
| POST | `/bindings/accessrules-accesspoints/delete` | Удалить |

> Все POST-привязки возвращают **204 No Content**. Нельзя назначать QR-коды посетителей.

---

## 10. Access Rules (Правила доступа)

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/accessrules` | Список |
| GET | `/accessrules/{id}` | По ID |
| POST | `/accessrules` | Создать (обяз: `name`) |
| PUT | `/accessrules/{id}` | Обновить |
| DELETE | `/accessrules/{id}` | Удалить |
| GET | `/accessrules/count` | Кол-во |
| GET | `/accessrules/hierarchy` | Папки правил доступа |

**Доп. query-параметры GET:** `level`, `name`, `deployments`, `folderId`, `type` (`NORMAL`/`DOOR`), `startDate[operation]`, `endDate[operation]`

**Операции дат:** `EQ`, `GT`, `LT`, `GTE`, `LTE` (URL-encoded: `startDate%5Bgte%5D=2023-05-10`)

**Объект:**
```json
{
  "id": 1,
  "name": "Default",
  "description": "Working days 9:00-18:00",
  "startDate": "2021-01-01",
  "endDate": "2022-01-01",
  "level": 1,
  "folderId": 1
}
```

---

## 11. Access Points (Точки доступа)

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/accesspoints` | Список |
| GET | `/accesspoints/{id}` | По ID |
| GET | `/accesspoints/hierarchy` | Папки точек доступа |
| GET | `/accesspoints/count` | Кол-во |

**Доп. query-параметры GET:** `name`, `folderId`

**Объект:**
```json
{ "id": 1, "name": "AccessPoint 1", "folderId": 1 }
```

---

## 12. Users (Пользователи системы)

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/users` | Список пользователей |
| GET | `/users/{id}` | По ID |
| POST | `/users` | Создать из существующего сотрудника |
| PUT | `/users/{id}` | Обновить (username, password, depRestriction, depAccessList) |
| DELETE | `/users/{id}` | Отозвать права (сотрудник не удаляется) |

**Объект:**
```json
{
  "id": 6,
  "username": "Administrator",
  "depRestriction": false,
  "depAccessList": []
}
```

**Создание:** body включает `employeeId`, `username`, `password`, `depRestriction`, `depAccessList`

---

## 13. Zones (Зоны)

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/zones` | Список (макс. 50 объектов) |
| GET | `/zones/{id}` | По ID |

**Доп. query-параметры GET:** `accessPointId`, `name`, `type` (`WORK`/`EVACUATION`)

**Объект:**
```json
{
  "id": 1,
  "name": "Zone 1",
  "type": "WORK",
  "accessPoints": [
    { "id": 1, "direction": "IN" },
    { "id": 2, "direction": "OUT" }
  ]
}
```

---

## 14. Custom Fields (Кастомные поля)

| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/custom/fields` | Список |
| POST | `/custom/fields` | Создать (обяз: `name`, `description`, `type`, `entity`; + `values` для LIST) |
| PUT | `/custom/fields/{id}` | Редактировать (для LIST — только добавление значений) |
| DELETE | `/custom/fields/{id}` | Удалить |

**Сущности (`entity`):** `EMPLOYEES`, `VEHICLES`, `DEPARTMENTS`, `POSITIONS`, `CARDS`, `VISITORS`, `VISITOR_VEHICLES`

**Типы (`type`):** `STRING`, `DATE`, `DATETIME`, `TIME`, `LONG`, `DOUBLE`, `BOOLEAN`, `LIST`

> Имя поля: только `[a-zA-Z0-9]`

---

## 15. Events (События)

### Типы событий

```
GET /events/types
```

### Список событий (raw)

```
GET /events
```

| Параметр | Описание |
|---|---|
| `eventTypeId` | Фильтр по типу: `?eventTypeId=6,12` |
| `lastId` | Только события с ID > указанного |
| `startTime` | От времени (ISO8601, `+` → `%2b`) |
| `endTime` | До времени |
| `accessObjectId` | По объекту доступа |
| `accessPointId` | По точке доступа |

**Объект:**
```json
{
  "id": 1,
  "type": 6,
  "timestamp": "2021-03-31T13:46:14+03:00",
  "accessPointId": 6543,
  "accessObjectId": 3456,
  "direction": "IN"
}
```

### Parsed Events (разобранные)

```
GET /events/parsed
```

| Параметр | Описание |
|---|---|
| `startTime` / `endTime` | Временной диапазон |
| `eventType` | Тип: `PASS_DETECTED`, `PASS_DENY` и др. |
| `accessPointId` / `accessObjectId` | Фильтр по точке/объекту |
| `cardKey` | По ключу карты |
| `lastId` / `lastLogId` | Пагинация по ID |

**Объект parsed event:**
```json
{
  "id": 1,
  "logId": 100,
  "data": {
    "accessPointId": 1,
    "direction": "IN",
    "passReasonCode": 5,
    "passReason": "Pass though open door",
    "employeeId": 45,
    "cardKey": "1800000100000000",
    "alcValue": 655.35,
    "zoneId": 1
  },
  "additionalData": {
    "accessObject": {
      "type": "EMPLOYEE",
      "data": { "id": 45, "name": "Ivanov Ivan", "position": "Developer" }
    },
    "zone": { "id": 1, "name": "Zone A" },
    "accessPoint": { "id": 1, "name": "AP1", "linkType": "ETHACTIVE" }
  },
  "eventType": "PASS_DETECTED",
  "timestamp": "2021-11-30T18:00:00+03:00",
  "receivedTime": "2021-11-30T18:00:01+03:00"
}
```

### Типы parsed events

| eventType | Описание |
|---|---|
| `PASS_DETECTED` | Проход зафиксирован |
| `PASS_DENY` | Доступ запрещён |
| `ACCESS_ABORTED` | Проход отменён по таймауту |
| `FIRE_UNLOCK_BEGIN/END` | Пожарная разблокировка |
| `DOOR_HOLD_BEGIN/END` | Удержание двери |
| `BOX_CLOSED/OPENED` | Корпус контроллера |
| `AP_ONLINE_STATUS` | Статус подключения (1=online, 0=offline) |
| `DEV_ACTION` | Эскорт-карта / состояние ворот |
| `VOLTAGE_STATUS` | Статус питания (Main supply / Battery) |
| `VOLTAGE_VALUE` | Изменение напряжения |
| `LPR_NUMBER_EVENT` | Распознание номера ТС |
| `MNG_STATE_CHANGED` | Смена режима двери (NORMAL/LOCKED/UNLOCKED) |
| `TEXT` / `TEXT2` | Текстовое сообщение / тревога |
| `WAITING_FOR_RULE_STAGE` | Ожидание эскорта/PIN/алко |
| `LOCK_FAIL` | Тревога датчика Холла |
| `FACE_RECOGNIZED` | Лицо распознано |
| `FACE_VERIFICATION_FAILED` | Лицо не распознано |
| `TEMPERATURE_ALERT/FINE/WARNING` | Температура |
| `FACE_MASK_VERIFICATION_*` | Проверка маски |
| `TEMPERATURE_VERIFICATION_FAILED` | Проверка температуры не пройдена |

### Коды причин прохода (`passReasonCode`)

| Код | Описание |
|---|---|
| 0 | Взлом |
| 1 | Проход в разблокированном режиме |
| 2 | Проход по кнопке |
| 3 | Проход по правилам |
| 4 | Авторизован внешней системой |
| 5 | Проход через открытую дверь |
| 6 | Регистрация на терминале без проверки доступа |

### Коды причин отказа (`denyReasonCode`)

| Код | Описание |
|---|---|
| 0 | Неверный PIN |
| 1 | Ключ просрочен |
| 3 | Неизвестный ключ |
| 4 | По временным зонам |
| 5 | Нет доступа к этой двери |
| 6 | Нет доступа в это время |
| 7 | Антипассбэк |
| 11 | Дверь заблокирована |
| 14 | Лимит вместимости зоны |
| 16 | Превышение алкоголя |
| 28 | Лицо не идентифицировано |
| 35 | Проверка температуры не пройдена |
| 37 | Маска отсутствует |

### Значения `direction`

`IN`, `OUT`, `NOT DEFINED`, `UNKNOWN`

---

## 16. Коды ошибок

| Код | Описание |
|---|---|
| 400 | Некорректный запрос |
| 401 | Не авторизован |
| 403 | Доступ запрещён |
| 404 | Не найдено |
| 422 | Ошибка валидации |
| 500 | Внутренняя ошибка сервера |

**Формат ответа ошибки:**
```json
{
  "status": 400,
  "errors": ["<описание ошибки>"]
}
```
