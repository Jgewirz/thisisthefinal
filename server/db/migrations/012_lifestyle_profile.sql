CREATE TABLE IF NOT EXISTS lifestyle_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    preference_type TEXT NOT NULL,
    preference_key TEXT NOT NULL,
    preference_value TEXT,
    confidence REAL DEFAULT 0.5,
    signal_count INTEGER DEFAULT 1,
    first_seen TEXT DEFAULT (datetime('now')),
    last_seen TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lifestyle_pref_unique
  ON lifestyle_preferences(user_id, preference_type, preference_key);
