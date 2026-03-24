-- Fitness class bookings (Mindbody + manual tracking)

CREATE TABLE IF NOT EXISTS fitness_bookings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  class_name TEXT NOT NULL,
  instructor TEXT,
  studio_name TEXT NOT NULL,
  studio_address TEXT,
  class_date TEXT NOT NULL,           -- YYYY-MM-DD
  class_time TEXT NOT NULL,           -- e.g. "6:00 PM"
  duration TEXT,
  category TEXT,
  booking_platform TEXT NOT NULL DEFAULT 'manual',  -- 'mindbody' | 'website' | 'manual' | 'browser'
  booking_status TEXT NOT NULL DEFAULT 'confirmed',  -- 'confirmed' | 'cancelled' | 'pending'
  external_booking_id TEXT,           -- Mindbody visit ID
  mindbody_site_id TEXT,
  mindbody_class_id TEXT,
  booking_url TEXT,
  studio_lat REAL,
  studio_lng REAL,
  studio_website TEXT,
  studio_google_maps_url TEXT,
  booked_at TEXT DEFAULT (datetime('now')),
  cancelled_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_fitness_bookings_user ON fitness_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_fitness_bookings_date ON fitness_bookings(class_date);
CREATE INDEX IF NOT EXISTS idx_fitness_bookings_status ON fitness_bookings(user_id, booking_status);

-- Mindbody client accounts (one per user per site)
CREATE TABLE IF NOT EXISTS mindbody_clients (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  site_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, site_id)
);
