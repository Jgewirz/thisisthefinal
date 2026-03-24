CREATE TABLE IF NOT EXISTS flight_bookings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_id TEXT NOT NULL UNIQUE,
  flight_data TEXT NOT NULL,
  passenger_info TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  confirmation_code TEXT,
  calendar_event_id TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);
