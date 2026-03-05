-- User location columns (additive — safe for existing rows)

ALTER TABLE users ADD COLUMN location_lat REAL;
ALTER TABLE users ADD COLUMN location_lng REAL;
ALTER TABLE users ADD COLUMN location_city TEXT;
ALTER TABLE users ADD COLUMN location_region TEXT;
ALTER TABLE users ADD COLUMN location_country TEXT;
ALTER TABLE users ADD COLUMN location_timezone TEXT;
ALTER TABLE users ADD COLUMN location_nearest_airport TEXT;
ALTER TABLE users ADD COLUMN location_updated_at TEXT;
