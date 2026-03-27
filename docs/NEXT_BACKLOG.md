# Бэклог — следующие шаги

Дата обновления: 2026-03-25

---

## P1 — Критично перед production

| # | Задача | Модуль | Обоснование |
|---|--------|--------|-------------|
| 1 | Установить `LOGIN_2FA_ENABLED=true` и `CRITICAL_2FA_ENABLED=true` | Auth | Feature flags готовы, нужно включить в production .env |
| 2 | Установить `NODE_ENV=production` | Infra | Активирует строгие rate limits и другие production-режимы |
| 3 | ~~Smoke автотесты~~ | ~~Testing~~ | **DONE**: 8 smoke-тестов (vitest+supertest) |
| 4 | ~~Пагинация Sigur~~ | ~~Sigur~~ | **DONE**: `fetchAllPaginated` уже работает корректно |
| 5 | ~~Rate limiting на auth~~ | ~~Auth~~ | **DONE**: production/dev лимиты через NODE_ENV |

---

## P2 — Важно, но не блокирует запуск

| # | Задача | Модуль | Обоснование |
|---|--------|--------|-------------|
| 1 | Отображение диагностических полей Sigur на фронте | SKUD/Frontend | matchedBySigurId, paginatedDays и пр. уже возвращаются, но не видны |
| 2 | Encryption key rotation | Security | Нет механизма ротации ключа шифрования ФИО |
| 3 | Chat — доведение до production | Chat | 6 эндпоинтов реализованы, Socket.IO настроен, модуль заморожен |
| 4 | Audit — фильтрация и экспорт | Audit | MVP: только запись и просмотр, нет фильтров по дате/типу |
| 5 | Integration-тесты для SKUD-сценариев | Testing | daily summary, backfill, employee matching |
| 6 | Token revocation при смене 2FA-настроек | Auth | JWT с baked-in 2FA claims не инвалидируется при изменении в БД |

---

## P3 — Улучшения и оптимизация

| # | Задача | Модуль | Обоснование |
|---|--------|--------|-------------|
| 1 | Мониторинг (Grafana/Prometheus) | Infra | Нет метрик, алертинга |
| 2 | Оптимизация bundle (exceljs 937 KB) | Frontend | Dynamic import или замена на lightweight библиотеку |
| 3 | Архивация старых SKUD-событий | SKUD | Таблица skud_events будет расти неограниченно |
| 4 | Connection pooling для Supabase | Backend | Один клиент без пула |
| 5 | CI/CD pipeline | Infra | Сборка и деплой ручные |
| 6 | E2E тесты (Playwright) | Testing | Покрытие фронтенд-сценариев |

---

## Текущий статус модулей

| Модуль | Статус | Готовность |
|--------|--------|------------|
| Auth + JWT + 2FA | Стабилен | Production-ready (feature flags готовы) |
| Rate Limiting | Стабилен | Production-ready (NODE_ENV=production) |
| Employees | Стабилен | Production-ready |
| Structure | Стабилен | Production-ready |
| Timesheet | Стабилен | Production-ready |
| SKUD / Sigur | Стабилен | Production-ready (пагинация работает) |
| Audit | MVP | Требует P2 доработок |
| Chat | Заморожен | Не готов к production |
| Smoke Tests | 8 тестов | Базовое покрытие |
