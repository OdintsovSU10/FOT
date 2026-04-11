-- Migration 017: доступ к новым SKUD travel-страницам

BEGIN;

INSERT INTO role_page_access (role_code, page_path, can_view, can_edit)
VALUES
  ('super_admin', '/skud-settings', true, true),
  ('header', '/skud-travel', true, true),
  ('hr', '/skud-travel', true, true),
  ('admin', '/skud-travel', true, true),
  ('super_admin', '/skud-travel', true, true)
ON CONFLICT (role_code, page_path) DO UPDATE
SET
  can_view = role_page_access.can_view OR EXCLUDED.can_view,
  can_edit = role_page_access.can_edit OR EXCLUDED.can_edit;

COMMIT;
