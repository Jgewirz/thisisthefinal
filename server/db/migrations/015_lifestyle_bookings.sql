CREATE TABLE IF NOT EXISTS lifestyle_bookings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    booking_type TEXT NOT NULL DEFAULT 'restaurant',
    venue_name TEXT NOT NULL,
    venue_address TEXT,
    venue_phone TEXT,
    venue_place_id TEXT,
    booking_date TEXT NOT NULL,
    booking_time TEXT NOT NULL,
    party_size INTEGER,
    service_type TEXT,
    special_requests TEXT,
    booking_platform TEXT DEFAULT 'browser',
    booking_status TEXT NOT NULL DEFAULT 'pending',
    booking_url TEXT,
    venue_website TEXT,
    venue_google_maps_url TEXT,
    confirmation_code TEXT,
    booked_at TEXT DEFAULT (datetime('now')),
    cancelled_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_lifestyle_bookings_user ON lifestyle_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_lifestyle_bookings_type ON lifestyle_bookings(booking_type);
