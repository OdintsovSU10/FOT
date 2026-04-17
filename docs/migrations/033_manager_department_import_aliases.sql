create table if not exists public.manager_department_import_employee_aliases (
  id uuid primary key default gen_random_uuid(),
  source_type text not null default 'manager_excel_admin_ui',
  section_name_normalized text not null default '',
  manager_name_normalized text not null,
  manager_name_original text not null,
  employee_id bigint not null references public.employees(id) on delete cascade,
  is_active boolean not null default true,
  created_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, section_name_normalized, manager_name_normalized)
);

create index if not exists idx_manager_department_import_employee_aliases_employee
  on public.manager_department_import_employee_aliases(employee_id, is_active);

create table if not exists public.manager_department_import_brigade_aliases (
  id uuid primary key default gen_random_uuid(),
  source_type text not null default 'manager_excel_admin_ui',
  section_name_normalized text not null default '',
  brigade_name_normalized text not null,
  brigade_name_original text not null,
  department_id uuid not null references public.org_departments(id) on delete cascade,
  is_active boolean not null default true,
  created_by uuid null references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, section_name_normalized, brigade_name_normalized)
);

create index if not exists idx_manager_department_import_brigade_aliases_department
  on public.manager_department_import_brigade_aliases(department_id, is_active);
