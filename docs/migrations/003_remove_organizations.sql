-- Миграция: удаление концепции "организаций"
-- Все данные привязываются к отделам (org_departments) из Sigur, а не к организациям.
-- ВАЖНО: выполнять ПОСЛЕ деплоя кода, который не использует organization_id.

BEGIN;

-- 1. Удалить столбцы organization_id из всех таблиц
ALTER TABLE employees DROP COLUMN IF EXISTS organization_id;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS organization_id;
ALTER TABLE chat_conversations DROP COLUMN IF EXISTS organization_id;
ALTER TABLE leave_requests DROP COLUMN IF EXISTS organization_id;
ALTER TABLE documents DROP COLUMN IF EXISTS organization_id;
ALTER TABLE payslips DROP COLUMN IF EXISTS organization_id;
ALTER TABLE payments DROP COLUMN IF EXISTS organization_id;
ALTER TABLE timesheet_approvals DROP COLUMN IF EXISTS organization_id;
ALTER TABLE work_schedules DROP COLUMN IF EXISTS organization_id;
ALTER TABLE positions DROP COLUMN IF EXISTS organization_id;
ALTER TABLE org_sites DROP COLUMN IF EXISTS organization_id;
ALTER TABLE org_departments DROP COLUMN IF EXISTS organization_id;
ALTER TABLE skud_daily_summary DROP COLUMN IF EXISTS organization_id;
ALTER TABLE skud_events DROP COLUMN IF EXISTS organization_id;
ALTER TABLE skud_sync_department_filter DROP COLUMN IF EXISTS organization_id;

-- 2. Удалить таблицу organizations
DROP TABLE IF EXISTS organizations CASCADE;

-- 3. Проверить и пересоздать уникальные ограничения без organization_id
-- Выполнить перед миграцией:
-- SELECT conname, conrelid::regclass, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE pg_get_constraintdef(oid) LIKE '%organization_id%';

COMMIT;
