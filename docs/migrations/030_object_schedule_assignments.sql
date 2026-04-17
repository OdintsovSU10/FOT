-- Migration 030: объектные графики работы
-- Позволяет назначать шаблоны графиков конкретным объектам SKUD с историей периодов.

BEGIN;

CREATE TABLE IF NOT EXISTS object_schedule_assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id      UUID NOT NULL REFERENCES skud_objects(id) ON DELETE CASCADE,
  schedule_id    UUID NOT NULL REFERENCES work_schedules(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to   DATE,
  created_by     INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (object_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_object_schedule_assignments_object_from
  ON object_schedule_assignments (object_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_object_schedule_assignments_active
  ON object_schedule_assignments (object_id, effective_to, effective_from DESC);

CREATE OR REPLACE FUNCTION ensure_no_overlapping_object_schedule_assignments()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM object_schedule_assignments existing
    WHERE existing.object_id = NEW.object_id
      AND (to_jsonb(existing)->>'id') IS DISTINCT FROM (to_jsonb(NEW)->>'id')
      AND daterange(existing.effective_from, COALESCE(existing.effective_to, 'infinity'::date), '[]')
          && daterange(NEW.effective_from, COALESCE(NEW.effective_to, 'infinity'::date), '[]')
  ) THEN
    RAISE EXCEPTION 'Overlapping object_schedule_assignments period for object_id=%', NEW.object_id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ensure_no_overlapping_object_schedule_assignments ON object_schedule_assignments;
CREATE TRIGGER trg_ensure_no_overlapping_object_schedule_assignments
BEFORE INSERT OR UPDATE ON object_schedule_assignments
FOR EACH ROW
EXECUTE FUNCTION ensure_no_overlapping_object_schedule_assignments();

COMMIT;
