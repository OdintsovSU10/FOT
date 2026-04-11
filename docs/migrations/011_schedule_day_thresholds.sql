-- Migration 011: пороги "полного дня" для будних и выходных
-- Используются в табеле для визуализации переработок/недоработок:
--   hours_worked >= threshold → полный день (зелёный)
--   hours_worked <  threshold → неполный день / недоработка (жёлтый)
-- NULL = fallback на (work_hours*60 - lunch_minutes) для weekday и на full_day_threshold_minutes для weekend.

BEGIN;

ALTER TABLE work_schedules
  ADD COLUMN IF NOT EXISTS full_day_threshold_minutes         INT NULL,
  ADD COLUMN IF NOT EXISTS weekend_full_day_threshold_minutes INT NULL;

ALTER TABLE work_schedules
  DROP CONSTRAINT IF EXISTS work_schedules_full_day_threshold_check;
ALTER TABLE work_schedules
  ADD CONSTRAINT work_schedules_full_day_threshold_check
  CHECK (full_day_threshold_minutes IS NULL OR (full_day_threshold_minutes BETWEEN 0 AND 1440));

ALTER TABLE work_schedules
  DROP CONSTRAINT IF EXISTS work_schedules_weekend_full_day_threshold_check;
ALTER TABLE work_schedules
  ADD CONSTRAINT work_schedules_weekend_full_day_threshold_check
  CHECK (weekend_full_day_threshold_minutes IS NULL OR (weekend_full_day_threshold_minutes BETWEEN 0 AND 1440));

COMMIT;
