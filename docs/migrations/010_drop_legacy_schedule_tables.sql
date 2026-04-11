-- Migration 010: удаляем неиспользуемые таблицы employee_schedules и department_schedules.
-- Графики привязываются только через category_schedules → work_categories.

DROP TABLE IF EXISTS employee_schedules CASCADE;
DROP TABLE IF EXISTS department_schedules CASCADE;
