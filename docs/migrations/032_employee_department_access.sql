create table if not exists public.employee_department_access (
  id uuid primary key default gen_random_uuid(),
  employee_id bigint not null references public.employees(id) on delete cascade,
  department_id uuid not null references public.org_departments(id) on delete cascade,
  source text not null default 'manual_admin_ui',
  is_active boolean not null default true,
  created_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, department_id)
);

create index if not exists idx_employee_department_access_employee_active
  on public.employee_department_access(employee_id, is_active);

create index if not exists idx_employee_department_access_department_active
  on public.employee_department_access(department_id, is_active);
