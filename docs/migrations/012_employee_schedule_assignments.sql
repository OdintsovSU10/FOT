-- Migration 012: персональные назначения графиков сотрудникам
-- Позволяет задавать индивидуальный график поверх графика по категории труда.

BEGIN;

CREATE TABLE IF NOT EXISTS employee_schedule_assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  schedule_id    UUID NOT NULL REFERENCES work_schedules(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to   DATE,
  created_by     INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_employee_schedule_assignments_employee_from
  ON employee_schedule_assignments (employee_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_employee_schedule_assignments_active
  ON employee_schedule_assignments (employee_id, effective_to, effective_from DESC);

COMMIT;
