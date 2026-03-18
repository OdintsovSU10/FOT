-- 1. Найти ID тендерного отдела
SELECT id, name FROM org_departments WHERE name ILIKE '%тендер%';

-- 2. После получения ID отдела, обновите нужного пользователя:
-- UPDATE user_profiles
-- SET position_type = 'header',
--     department_id = '<TENDER_DEPT_ID>',
--     employee_id = (SELECT id FROM employees WHERE org_department_id = '<TENDER_DEPT_ID>' LIMIT 1)
-- WHERE id = '<USER_ID>';

-- Или для быстрого теста через DevRoleSwitcher:
-- Просто переключите роль на "Руководитель" в DEV-панели (нижний правый угол)
