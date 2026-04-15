-- Migration 026: карта объекта СКУД и маркеры точек доступа

BEGIN;

ALTER TABLE skud_objects
  ADD COLUMN IF NOT EXISTS map_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS map_file_name TEXT,
  ADD COLUMN IF NOT EXISTS map_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS map_file_size BIGINT,
  ADD COLUMN IF NOT EXISTS map_uploaded_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS skud_object_map_points (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id         UUID NOT NULL REFERENCES skud_objects(id) ON DELETE CASCADE,
  access_point_name TEXT NOT NULL,
  x_ratio           NUMERIC(8, 6) NOT NULL CHECK (x_ratio >= 0 AND x_ratio <= 1),
  y_ratio           NUMERIC(8, 6) NOT NULL CHECK (y_ratio >= 0 AND y_ratio <= 1),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (access_point_name),
  UNIQUE (object_id, access_point_name)
);

CREATE INDEX IF NOT EXISTS idx_skud_object_map_points_object_id
  ON skud_object_map_points (object_id);

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'skud-object-maps',
  'skud-object-maps',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
