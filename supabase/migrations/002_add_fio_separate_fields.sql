-- Добавляем раздельные зашифрованные поля ФИО в таблицу employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS last_name_encrypted text,
  ADD COLUMN IF NOT EXISTS first_name_encrypted text,
  ADD COLUMN IF NOT EXISTS middle_name_encrypted text;

COMMENT ON COLUMN public.employees.last_name_encrypted IS 'Фамилия (зашифровано)';
COMMENT ON COLUMN public.employees.first_name_encrypted IS 'Имя (зашифровано)';
COMMENT ON COLUMN public.employees.middle_name_encrypted IS 'Отчество (зашифровано)';
