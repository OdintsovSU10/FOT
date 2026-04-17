BEGIN;

INSERT INTO access_pages (
  key,
  label,
  group_code,
  group_label,
  surface,
  supports_edit,
  requires_data_scope,
  requires_employee_variant,
  sort_order,
  is_active,
  is_system
)
VALUES (
  '/employees/structure-manage',
  'Управление деревом отделов',
  'technical',
  'Технические доступы',
  'technical',
  true,
  false,
  false,
  282,
  true,
  true
)
ON CONFLICT (key) DO UPDATE
SET
  label = EXCLUDED.label,
  group_code = EXCLUDED.group_code,
  group_label = EXCLUDED.group_label,
  surface = EXCLUDED.surface,
  supports_edit = EXCLUDED.supports_edit,
  requires_data_scope = EXCLUDED.requires_data_scope,
  requires_employee_variant = EXCLUDED.requires_employee_variant,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  is_system = EXCLUDED.is_system,
  updated_at = NOW();

COMMIT;
