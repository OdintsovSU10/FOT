-- Migration 009: work_categories → отдельная таблица с CRUD через UI.
-- Применяется после 008_schedules_v2.sql.

BEGIN;

-- 1) Таблица категорий труда
CREATE TABLE IF NOT EXISTS work_categories (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INT  NOT NULL DEFAULT 0,
  is_active   BOOL NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2) Стартовые значения
INSERT INTO work_categories (code, name, sort_order) VALUES
  ('itr',     'ИТР',          10),
  ('worker',  'Рабочий',      20),
  ('staff',   'Сотрудник',    30),
  ('manager', 'Руководитель', 40)
ON CONFLICT (code) DO NOTHING;

-- 3) Снимаем старые CHECK-констрейнты
ALTER TABLE employees
  DROP CONSTRAINT IF EXISTS employees_work_category_check;

ALTER TABLE category_schedules
  DROP CONSTRAINT IF EXISTS category_schedules_category_check;

-- 4) FK на work_categories
ALTER TABLE employees
  ADD CONSTRAINT employees_work_category_fkey
  FOREIGN KEY (work_category) REFERENCES work_categories(code) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE category_schedules
  ADD CONSTRAINT category_schedules_category_fkey
  FOREIGN KEY (category) REFERENCES work_categories(code) ON UPDATE CASCADE ON DELETE CASCADE;

COMMIT;
