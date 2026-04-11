-- Migration 008: schedules v2 — категории труда, новые поля графиков, сброс старых привязок
-- Применяется после 007_day_overrides.sql
-- ВНИМАНИЕ: TRUNCATE стирает все текущие шаблоны и привязки графиков.

BEGIN;

-- 1) Полный сброс старых графиков и привязок
TRUNCATE TABLE employee_schedules, department_schedules, work_schedules RESTART IDENTITY CASCADE;

-- 2) Новые поля в work_schedules
ALTER TABLE work_schedules
  ADD COLUMN IF NOT EXISTS lunch_minutes                INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS respects_holidays            BOOL NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pattern_type                 TEXT NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS expected_saturdays_per_month INT  NOT NULL DEFAULT 0;

ALTER TABLE work_schedules
  DROP CONSTRAINT IF EXISTS work_schedules_pattern_type_check;
ALTER TABLE work_schedules
  ADD CONSTRAINT work_schedules_pattern_type_check
  CHECK (pattern_type IN ('5+0','5+2','6+0','custom'));

-- 3) Категория труда сотрудника (enum строкой)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS work_category TEXT;

ALTER TABLE employees
  DROP CONSTRAINT IF EXISTS employees_work_category_check;
ALTER TABLE employees
  ADD CONSTRAINT employees_work_category_check
  CHECK (work_category IS NULL OR work_category IN ('itr','worker','staff','manager'));

-- 4) Привязка графиков к категориям труда
CREATE TABLE IF NOT EXISTS category_schedules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category       TEXT NOT NULL CHECK (category IN ('itr','worker','staff','manager')),
  schedule_id    UUID NOT NULL REFERENCES work_schedules(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to   DATE,
  created_by     INT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (category, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_category_schedules_category_from
  ON category_schedules (category, effective_from DESC);

-- 5) Расширение производственного календаря: праздники
ALTER TABLE production_calendar
  ADD COLUMN IF NOT EXISTS holidays           DATE[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mandatory_holidays DATE[] NOT NULL DEFAULT '{}';

-- 6) Минимальный фолбэк: один дефолтный шаблон
INSERT INTO work_schedules (
  name, schedule_type, work_start, work_end, work_hours, work_days,
  office_days, late_threshold_minutes, is_default,
  lunch_minutes, respects_holidays, pattern_type, expected_saturdays_per_month
) VALUES (
  'Default 5+0', 'office', '09:00', '18:00', 9, '{1,2,3,4,5}',
  NULL, 0, true,
  35, true, '5+0', 0
);

COMMIT;
