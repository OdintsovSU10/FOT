-- Migration 016: split legacy worker role into office/object roles
-- and seed dynamic access-control permissions for the roles page model.

-- 1. Безопасные дефолты для permissions.
UPDATE system_roles
SET permissions = '[]'::jsonb
WHERE permissions IS NULL;

-- 2. Создаём новые системные роли.
INSERT INTO system_roles (code, name, description, permissions, level, is_active, is_system)
VALUES
  ('worker_office', 'Офисный сотрудник', null, '[]'::jsonb, 1, true, true),
  ('worker_object', 'Рабочий', null, '[]'::jsonb, 1, true, true)
ON CONFLICT (code) DO NOTHING;

-- 3. Если legacy worker существовал, переносим его метаданные в worker_office.
UPDATE system_roles AS office
SET
  description = COALESCE(office.description, legacy.description),
  level = COALESCE(legacy.level, office.level),
  is_active = legacy.is_active,
  is_system = true,
  updated_at = NOW()
FROM system_roles AS legacy
WHERE legacy.code = 'worker'
  AND office.code = 'worker_office';

UPDATE system_roles
SET
  name = 'Офисный сотрудник',
  level = 1,
  is_system = true,
  updated_at = NOW()
WHERE code = 'worker_office';

UPDATE system_roles
SET
  name = 'Рабочий',
  level = 1,
  is_system = true,
  updated_at = NOW()
WHERE code = 'worker_object';

-- 4. Нормализуем матрицу доступа: edit всегда подразумевает view.
UPDATE role_page_access
SET can_view = true
WHERE can_edit = true
  AND can_view = false;

-- 5. Удаляем legacy /profile из матрицы.
DELETE FROM role_page_access
WHERE page_path = '/profile';

-- 6. Переносим существующий доступ worker -> worker_office.
INSERT INTO role_page_access (role_code, page_path, can_view, can_edit)
SELECT
  'worker_office',
  page_path,
  COALESCE(can_view, false) OR COALESCE(can_edit, false),
  COALESCE(can_edit, false)
FROM role_page_access
WHERE role_code = 'worker'
ON CONFLICT (role_code, page_path) DO UPDATE
SET
  can_view = role_page_access.can_view OR EXCLUDED.can_view,
  can_edit = role_page_access.can_edit OR EXCLUDED.can_edit;

-- 7. Сидируем employee-кабинеты для офисных ролей и рабочего на объекте.
INSERT INTO role_page_access (role_code, page_path, can_view, can_edit)
VALUES
  ('worker_office', '/employee', true, false),
  ('worker_office', '/employee/requests', true, true),
  ('worker_office', '/employee/payslips', true, false),
  ('worker_office', '/employee/payments', true, false),
  ('worker_office', '/employee/documents', true, true),
  ('worker_office', '/employee/timesheet', true, true),
  ('worker_office', '/employee/history', true, false),
  ('worker_office', '/employee/salary-raise', true, true),

  ('worker_object', '/employee', true, false),
  ('worker_object', '/employee/requests', true, true),
  ('worker_object', '/employee/payslips', true, false),
  ('worker_object', '/employee/payments', true, false),
  ('worker_object', '/employee/documents', true, true),
  ('worker_object', '/employee/timesheet', true, true),

  ('header', '/employee', true, false),
  ('header', '/employee/requests', true, true),
  ('header', '/employee/payslips', true, false),
  ('header', '/employee/payments', true, false),
  ('header', '/employee/documents', true, true),
  ('header', '/employee/timesheet', true, true),
  ('header', '/employee/history', true, false),
  ('header', '/employee/salary-raise', true, true),
  ('header', '/salary-raise-review', true, true),

  ('hr', '/employee', true, false),
  ('hr', '/employee/requests', true, true),
  ('hr', '/employee/payslips', true, false),
  ('hr', '/employee/payments', true, false),
  ('hr', '/employee/documents', true, true),
  ('hr', '/employee/timesheet', true, true),
  ('hr', '/employee/history', true, false),
  ('hr', '/employee/salary-raise', true, true),
  ('hr', '/salary-raise-review', true, true),
  ('hr', '/timesheet-hr', true, true),

  ('admin', '/employee', true, false),
  ('admin', '/employee/requests', true, true),
  ('admin', '/employee/payslips', true, false),
  ('admin', '/employee/payments', true, false),
  ('admin', '/employee/documents', true, true),
  ('admin', '/employee/timesheet', true, true),
  ('admin', '/employee/history', true, false),
  ('admin', '/employee/salary-raise', true, true),
  ('admin', '/salary-raise-review', true, true),
  ('admin', '/timesheet-hr', true, true),

  ('super_admin', '/employee', true, false),
  ('super_admin', '/employee/requests', true, true),
  ('super_admin', '/employee/payslips', true, false),
  ('super_admin', '/employee/payments', true, false),
  ('super_admin', '/employee/documents', true, true),
  ('super_admin', '/employee/timesheet', true, true),
  ('super_admin', '/employee/history', true, false),
  ('super_admin', '/employee/salary-raise', true, true),
  ('super_admin', '/salary-raise-review', true, true),
  ('super_admin', '/timesheet-hr', true, true)
ON CONFLICT (role_code, page_path) DO UPDATE
SET
  can_view = role_page_access.can_view OR EXCLUDED.can_view,
  can_edit = role_page_access.can_edit OR EXCLUDED.can_edit;

-- 8. Сидируем capability-права через system_roles.permissions.
DO $$
DECLARE
  role_seed RECORD;
BEGIN
  FOR role_seed IN
    SELECT *
    FROM (
      VALUES
        ('worker_office', ARRAY['portal.employee.variant.office', 'data.scope.self']::text[]),
        ('worker_object', ARRAY['portal.employee.variant.object', 'data.scope.self']::text[]),
        ('header', ARRAY['portal.employee.variant.office', 'data.scope.department']::text[]),
        ('hr', ARRAY['portal.employee.variant.office', 'data.scope.all']::text[]),
        ('admin', ARRAY['portal.employee.variant.office', 'data.scope.all']::text[]),
        ('super_admin', ARRAY['portal.employee.variant.office', 'data.scope.all']::text[])
    ) AS seeds(code, permissions)
  LOOP
    UPDATE system_roles AS sr
    SET
      permissions = (
        WITH filtered AS (
          SELECT value
          FROM jsonb_array_elements_text(COALESCE(sr.permissions, '[]'::jsonb)) AS existing(value)
          WHERE value NOT LIKE 'portal.employee.variant.%'
            AND value NOT LIKE 'data.scope.%'
        ),
        merged AS (
          SELECT value FROM filtered
          UNION
          SELECT unnest(role_seed.permissions) AS value
        )
        SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb)
        FROM merged
      ),
      updated_at = NOW()
    WHERE sr.code = role_seed.code;
  END LOOP;
END $$;

-- 9. Переносим пользователей и дефолты на новую офисную роль.
UPDATE user_profiles
SET position_type = 'worker_office'
WHERE position_type = 'worker';

ALTER TABLE user_profiles
  ALTER COLUMN position_type SET DEFAULT 'worker_office';

-- 10. Если существует таблица кодов привязки, переносим и её.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'employee_link_codes'
  ) THEN
    EXECUTE $sql$
      UPDATE employee_link_codes
      SET position_type = 'worker_office'
      WHERE position_type = 'worker'
    $sql$;
  END IF;
END $$;

-- 11. Если в БД ещё живёт legacy FK user_profiles.system_role_id -> system_roles.id,
-- синхронизируем его по новому position_type, чтобы удаление worker не падало.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'system_role_id'
  ) THEN
    EXECUTE $sql$
      UPDATE user_profiles AS up
      SET system_role_id = sr.id
      FROM system_roles AS sr
      WHERE sr.code = up.position_type
        AND up.system_role_id IS DISTINCT FROM sr.id
    $sql$;
  END IF;
END $$;

-- 12. Удаляем legacy worker после переноса ссылок.
DELETE FROM role_page_access
WHERE role_code = 'worker';

DELETE FROM system_roles
WHERE code = 'worker';
