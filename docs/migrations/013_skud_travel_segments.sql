-- Migration 013: объекты, маршруты и предрасчёт передвижений между объектами

BEGIN;

CREATE TABLE IF NOT EXISTS skud_objects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skud_object_access_points (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id         UUID NOT NULL REFERENCES skud_objects(id) ON DELETE CASCADE,
  access_point_name TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (access_point_name),
  UNIQUE (object_id, access_point_name)
);

CREATE INDEX IF NOT EXISTS idx_skud_object_access_points_object_id
  ON skud_object_access_points (object_id);

CREATE TABLE IF NOT EXISTS skud_object_routes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_object_id    UUID NOT NULL REFERENCES skud_objects(id) ON DELETE CASCADE,
  to_object_id      UUID NOT NULL REFERENCES skud_objects(id) ON DELETE CASCADE,
  travel_minutes    INT NOT NULL CHECK (travel_minutes > 0 AND travel_minutes <= 1440),
  credit_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.5 CHECK (credit_multiplier >= 1 AND credit_multiplier <= 10),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_object_id <> to_object_id),
  UNIQUE (from_object_id, to_object_id)
);

CREATE INDEX IF NOT EXISTS idx_skud_object_routes_from_to
  ON skud_object_routes (from_object_id, to_object_id);

CREATE TABLE IF NOT EXISTS skud_travel_segments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id            INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date              DATE NOT NULL,
  from_object_id         UUID REFERENCES skud_objects(id) ON DELETE SET NULL,
  to_object_id           UUID REFERENCES skud_objects(id) ON DELETE SET NULL,
  from_access_point_name TEXT,
  to_access_point_name   TEXT,
  exit_time              TIME NOT NULL,
  entry_time             TIME NOT NULL,
  actual_minutes         INT NOT NULL CHECK (actual_minutes >= 0),
  norm_minutes           INT,
  max_credit_minutes     INT,
  credited_minutes       INT NOT NULL DEFAULT 0 CHECK (credited_minutes >= 0),
  delay_minutes          INT NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
  status                 TEXT NOT NULL CHECK (status IN ('auto_approved', 'delayed', 'needs_object', 'needs_route')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date, exit_time, entry_time, from_access_point_name, to_access_point_name)
);

CREATE INDEX IF NOT EXISTS idx_skud_travel_segments_employee_date
  ON skud_travel_segments (employee_id, work_date);

CREATE INDEX IF NOT EXISTS idx_skud_travel_segments_status
  ON skud_travel_segments (status, work_date DESC);

COMMIT;
