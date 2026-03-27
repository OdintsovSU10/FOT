# Sigur Import — техническая справка

Дата фиксации: 2026-03-25

---

## Агрегаты импорта событий (ISyncEventsResult)

### Основные поля (используются на фронте)

| Поле | Тип | Описание |
|------|-----|----------|
| `sigurTotal` | number | Всего событий из Sigur API за период |
| `imported` | number | Успешно вставлено в БД |
| `skipped` | number | Пропущено (дедупликация по hash) |
| `droppedNoName` | number | Отброшено — нет ФИО в событии |
| `droppedNoOrg` | number | Отброшено — нет organization_id |
| `filteredByDept` | number | Отфильтровано whitelist'ом отделов |
| `unmatchedEmployees` | number | Уникальных имён без привязки к сотруднику |
| `filteredEmployeeNames` | string[] | Топ-20 отфильтрованных имён |
| `matched` | number | Кол-во пересчитанных daily summary (уникальных emp+org+date) |
| `errors` | string[] | Ошибки вставки |

### Диагностические поля (optional, не отображаются на фронте)

| Поле | Тип | Описание |
|------|-----|----------|
| `matchedEvents` | number | Событий, привязанных к сотруднику |
| `unmatchedEvents` | number | Событий без привязки к сотруднику |
| `matchedBySigurId` | number | Привязано через sigur_employee_id |
| `matchedByName` | number | Привязано через fallback по ФИО+организация |
| `truncatedDays` | number | Дней с возможным усечением (ровно 3000 событий) |
| `noNameSamples` | unknown[] | До 3 компактных сэмплов событий без ФИО |

---

## Интерпретация метрик

### matched vs matchedEvents

- **matched** = количество уникальных комбинаций `сотрудник + организация + дата`, для которых пересчитан daily summary. Это НЕ количество событий.
- **matchedEvents** = количество отдельных событий, успешно привязанных к сотруднику.

### matchedBySigurId vs matchedByName

Приоритет сопоставления:
1. **По sigur_employee_id** — если у сотрудника в БД есть `sigur_employee_id` и событие содержит тот же ID. Самый надёжный метод.
2. **По ФИО + организация** — fallback, если sigur_id не найден. Строит ключ `normalizePersonName(name)|org_id`.

`matchedBySigurId + matchedByName ≈ matchedEvents` (без учёта отфильтрованных/дедуплицированных).

### unmatchedEvents

Событие прошло все фильтры (whitelist, dedup), но сотрудник не найден ни по ID, ни по имени. Вставляется в `skud_events` с `employee_id = null`.

---

## Нормализация имён

Функция `normalizePersonName` (`sigur-sync-shared.ts`):
```
toLowerCase() → trim() → replace(/\s+/g, ' ')
```

Применяется в:
- Построение ключей `employeeByNameOrg`
- Whitelist-проверки (`allowedNames`)
- Fallback matching по имени
- `buildWhitelistedEmployeesCache`
- `getWhitelistedDbEmployeeSets`

---

## Пагинация событий

- `fetchAllPaginated()` (`sigur-base.service.ts`) автоматически загружает все страницы через offset/limit
- pageSize = 3000 (максимум API Sigur на одну страницу)
- Цикл продолжается пока `items.length === pageSize`, затем запрашивает следующую страницу
- **Усечение данных невозможно** — пагинация полностью реализована
- Диагностика: `paginatedDays` — количество дней, где потребовалось >1 страницы (>3000 событий)
- Поле `truncatedDays` deprecated (всегда 0), сохранено для обратной совместимости

---

## Known Risks

| Риск | Вероятность | Последствия | Митигация |
|------|-------------|-------------|-----------|
| noName события | Низкая | Некорректные данные в Sigur | noNameSamples для диагностики структуры |
| Множественные пробелы в ФИО | Низкая | Mismatch при сопоставлении | normalizePersonName |
| Дубликаты при повторном импорте | Нулевая | — | Дедупликация по dedup_hash |
| Большой объём событий (>10000/день) | Низкая | Медленная загрузка | Пагинация работает, но время растёт линейно |

---

## Поток синхронизации событий

```
1. Загрузка сотрудников из БД → Map<name|org, employee>, Map<sigurId, employee>
2. Загрузка whitelist отделов (если настроен)
3. Предзагрузка existing dedup hashes за весь период
4. Для каждого дня:
   a. Fetch events из Sigur (pageSize=3000)
   b. Проверка truncation
   c. Для каждого события:
      - mapSigurEvent (отсев no-name)
      - Whitelist фильтр
      - Dedup проверка
      - Match: sigur_id → name+org → unmatched
      - Добавление в batch
   d. Upsert batch (500 записей)
5. Пересчёт daily summaries через RPC
```
