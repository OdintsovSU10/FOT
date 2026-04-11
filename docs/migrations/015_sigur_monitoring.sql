-- 015: Мониторинг инцидентов Sigur

BEGIN;

CREATE TABLE IF NOT EXISTS sigur_health_checks (
  id BIGSERIAL PRIMARY KEY,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL CHECK (source IN ('presence_polling', 'monitor_probe', 'silence_detector')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failure', 'silence')),
  connection_type TEXT NULL CHECK (connection_type IN ('internal', 'external')),
  response_ms INTEGER NULL,
  events_last_window INTEGER NULL,
  baseline_events INTEGER NULL,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sigur_health_checks_checked_at
  ON sigur_health_checks (checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_sigur_health_checks_status_checked_at
  ON sigur_health_checks (status, checked_at DESC);

CREATE TABLE IF NOT EXISTS sigur_incidents (
  id BIGSERIAL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  detected_by TEXT NOT NULL CHECK (detected_by IN ('presence_polling', 'monitor_probe', 'silence_detector')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ NULL,
  last_success_at TIMESTAMPTZ NULL,
  affected_from TIMESTAMPTZ NULL,
  affected_to TIMESTAMPTZ NULL,
  connection_type TEXT NULL CHECK (connection_type IN ('internal', 'external')),
  error_message TEXT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  opened_notification_sent_at TIMESTAMPTZ NULL,
  resolved_notification_sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sigur_incidents_status_started_at
  ON sigur_incidents (status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sigur_incidents_started_at
  ON sigur_incidents (started_at DESC);

INSERT INTO system_settings (key, value, description, is_secret)
VALUES
  ('sigur_monitor_enabled', 'true', 'Включить мониторинг инцидентов Sigur', false),
  ('sigur_monitor_failure_threshold', '2', 'Количество подряд неуспешных проверок для открытия инцидента', false),
  ('sigur_monitor_recovery_threshold', '2', 'Количество подряд успешных проверок для закрытия инцидента', false),
  ('sigur_monitor_silence_window_minutes', '15', 'Окно в минутах без событий для проверки тишины', false),
  ('sigur_monitor_baseline_lookback_days', '28', 'Глубина lookback в днях для baseline трафика событий', false),
  ('sigur_monitor_baseline_min_events', '5', 'Минимальный baseline событий в слоте для детекции тишины', false),
  ('sigur_monitor_alert_cooldown_minutes', '60', 'Cooldown между уведомлениями о повторных инцидентах Sigur', false),
  ('sigur_monitor_timezone', 'Europe/Moscow', 'IANA timezone для мониторинга Sigur', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_page_access (role_code, page_path, can_view, can_edit)
VALUES
  ('admin', '/skud-monitor', true, false),
  ('super_admin', '/skud-monitor', true, false)
ON CONFLICT (role_code, page_path) DO NOTHING;

COMMIT;
