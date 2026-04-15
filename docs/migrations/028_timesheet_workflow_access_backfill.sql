-- 028: backfill timesheet workflow capability catalog and default role permissions
--
-- Root cause:
-- access_capability_catalog on live DB was seeded without timesheet.workflow.* options,
-- and default system_roles therefore still miss those permissions in permissions JSONB.
-- UI/runtime can infer legacy access from role_page_access, but the source of truth
-- should be repaired in the database as well.

INSERT INTO access_capability_catalog (
  group_code,
  option_code,
  group_label,
  group_description,
  option_label,
  option_description,
  exclusive,
  group_sort_order,
  option_sort_order,
  is_active
)
VALUES
  (
    'timesheet.workflow',
    'timesheet.workflow.submit',
    'Табели',
    'Определяет участие роли в подаче, проверке и контроле табелей.',
    'Подача',
    'Роль может подать или переподать табель своего охвата.',
    false,
    30,
    10,
    true
  ),
  (
    'timesheet.workflow',
    'timesheet.workflow.review',
    'Табели',
    'Определяет участие роли в подаче, проверке и контроле табелей.',
    'Проверка',
    'Роль может утверждать, отклонять и возвращать табели.',
    false,
    30,
    20,
    true
  ),
  (
    'timesheet.workflow',
    'timesheet.workflow.monitor',
    'Табели',
    'Определяет участие роли в подаче, проверке и контроле табелей.',
    'Мониторинг',
    'Роль видит очередь табелей и историю без права менять статус.',
    false,
    30,
    30,
    true
  )
ON CONFLICT (group_code, option_code) DO UPDATE
SET
  group_label = EXCLUDED.group_label,
  group_description = EXCLUDED.group_description,
  option_label = EXCLUDED.option_label,
  option_description = EXCLUDED.option_description,
  exclusive = EXCLUDED.exclusive,
  group_sort_order = EXCLUDED.group_sort_order,
  option_sort_order = EXCLUDED.option_sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

DO $$
DECLARE
  role_seed RECORD;
BEGIN
  FOR role_seed IN
    SELECT *
    FROM (
      VALUES
        ('header', ARRAY['timesheet.workflow.submit']::text[]),
        ('hr', ARRAY['timesheet.workflow.monitor']::text[]),
        ('admin', ARRAY['timesheet.workflow.monitor', 'timesheet.workflow.review']::text[]),
        ('super_admin', ARRAY['timesheet.workflow.submit', 'timesheet.workflow.monitor', 'timesheet.workflow.review']::text[])
    ) AS seeds(code, permissions)
  LOOP
    UPDATE system_roles AS sr
    SET
      permissions = (
        SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb)
        FROM (
          SELECT value
          FROM jsonb_array_elements_text(COALESCE(sr.permissions, '[]'::jsonb)) AS existing(value)
          UNION
          SELECT unnest(role_seed.permissions) AS value
        ) AS merged
      ),
      updated_at = NOW()
    WHERE sr.code = role_seed.code;
  END LOOP;
END $$;
