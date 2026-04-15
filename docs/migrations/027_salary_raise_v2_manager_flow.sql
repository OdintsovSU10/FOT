BEGIN;

ALTER TABLE salary_raise_requests
  ADD COLUMN IF NOT EXISTS flow_version INTEGER,
  ADD COLUMN IF NOT EXISTS manager_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS current_salary_entered NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS work_object_id TEXT,
  ADD COLUMN IF NOT EXISTS work_object_name TEXT,
  ADD COLUMN IF NOT EXISTS job_summary TEXT,
  ADD COLUMN IF NOT EXISTS manager_justification TEXT,
  ADD COLUMN IF NOT EXISTS admin_review JSONB,
  ADD COLUMN IF NOT EXISTS admin_reviewer_id UUID,
  ADD COLUMN IF NOT EXISTS admin_reviewed_at TIMESTAMPTZ;

UPDATE salary_raise_requests
SET flow_version = 1
WHERE flow_version IS NULL;

ALTER TABLE salary_raise_requests
  ALTER COLUMN flow_version SET DEFAULT 2,
  ALTER COLUMN flow_version SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_salary_raise_flow_version
  ON salary_raise_requests(flow_version);

CREATE INDEX IF NOT EXISTS idx_salary_raise_flow_status
  ON salary_raise_requests(flow_version, status);

DELETE FROM role_page_access
WHERE role_code IN ('header', 'hr')
  AND page_path = '/salary-raise-review';

DELETE FROM role_page_access
WHERE role_code IN ('worker', 'worker_office', 'hr', 'admin', 'super_admin')
  AND page_path = '/employee/salary-raise';

INSERT INTO role_page_access (role_code, page_path, can_view, can_edit)
VALUES ('header', '/employee/salary-raise', true, true)
ON CONFLICT (role_code, page_path) DO UPDATE
SET
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit;

INSERT INTO role_page_access (role_code, page_path, can_view, can_edit)
VALUES
  ('admin', '/salary-raise-review', true, true),
  ('super_admin', '/salary-raise-review', true, true)
ON CONFLICT (role_code, page_path) DO UPDATE
SET
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit;

COMMIT;
