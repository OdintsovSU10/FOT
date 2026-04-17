-- 031_manager_department_access.sql
-- Дополнительные управляемые бригады для руководителей.

CREATE TABLE IF NOT EXISTS user_department_access (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES org_departments(id) ON DELETE CASCADE,
  source        TEXT NOT NULL DEFAULT 'manual',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_user_department_access_user_active
  ON user_department_access (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_user_department_access_department_active
  ON user_department_access (department_id, is_active);
