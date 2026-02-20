-- Миграция 003: Иерархия отделов, подчинённость организаций, Sigur tracking
-- Дата: 2026-02-20

-- 1. Иерархия отделов: self-referential parent_id
ALTER TABLE public.org_departments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.org_departments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.org_departments.parent_id IS 'Родительский отдел для иерархии (self-referential)';

CREATE INDEX IF NOT EXISTS idx_org_departments_parent_id ON public.org_departments(parent_id);

-- 2. Подчинённость организаций: головная → подрядчики
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS parent_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.organizations.parent_organization_id IS 'Головная организация (для иерархии подрядчиков)';

CREATE INDEX IF NOT EXISTS idx_organizations_parent_id ON public.organizations(parent_organization_id);

-- 3. Sigur tracking для идемпотентной синхронизации
ALTER TABLE public.org_departments
  ADD COLUMN IF NOT EXISTS sigur_department_id integer;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS sigur_employee_id integer;

-- Уникальные индексы: один sigur_department_id на организацию
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_departments_sigur_id
  ON public.org_departments(organization_id, sigur_department_id)
  WHERE sigur_department_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_sigur_id
  ON public.employees(organization_id, sigur_employee_id)
  WHERE sigur_employee_id IS NOT NULL;
