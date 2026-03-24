CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    restaurant_name TEXT NOT NULL,
    restaurant_place_id TEXT,
    restaurant_email TEXT,
    restaurant_phone TEXT,
    restaurant_address TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    party_size INTEGER NOT NULL DEFAULT 2,
    special_requests TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    gmail_message_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user_date ON reservations(user_id, date);
