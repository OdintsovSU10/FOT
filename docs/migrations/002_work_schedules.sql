-- 002: Система графиков работы отделов и сотрудников
-- Типы: office, remote, hybrid, shift
-- Каскад: employee_schedules → department_schedules → work_schedules(is_default)

-- Шаблоны графиков работы
CREATE TABLE IF NOT EXISTS work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  schedule_type TEXT NOT NULL DEFAULT 'office'
    CHECK (schedule_type IN ('office', 'remote', 'hybrid', 'shift')),
  work_start TIME NOT NULL DEFAULT '09:00:00',
  work_end TIME NOT NULL DEFAULT '18:00:00',
  work_hours NUMERIC(4,2) NOT NULL DEFAULT 8,
  work_days INT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  office_days INT[] DEFAULT NULL,
  late_threshold_minutes INT NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Привязка графика к отделу (с историей)
CREATE TABLE IF NOT EXISTS department_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES org_departments(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES work_schedules(id) ON DELETE RESTRICT,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE DEFAULT NULL,
  created_by INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(department_id, effective_from)
);

-- Переопределение графика для сотрудника (с историей)
CREATE TABLE IF NOT EXISTS employee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES work_schedules(id) ON DELETE RESTRICT,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE DEFAULT NULL,
  reason TEXT,
  created_by INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, effective_from)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_work_sched_org ON work_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_dept_sched_dept ON department_schedules(department_id, effective_from);
CREATE INDEX IF NOT EXISTS idx_emp_sched_emp ON employee_schedules(employee_id, effective_from);

-- Дефолтный график для каждой организации
INSERT INTO work_schedules (organization_id, name, schedule_type, is_default)
SELECT id, 'Стандартный (офис)', 'office', true
FROM organizations
WHERE id NOT IN (SELECT organization_id FROM work_schedules WHERE is_default = true);
