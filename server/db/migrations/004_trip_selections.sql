-- Active trip selections (flights + hotels user is building a trip with)
CREATE TABLE IF NOT EXISTS trip_selections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('flight', 'hotel')),
  data TEXT NOT NULL DEFAULT '{}',
  label TEXT NOT NULL,
  selected_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trip_selections_user ON trip_selections(user_id);

-- Index on travel_bookmarks for user lookups (table exists from 002)
CREATE INDEX IF NOT EXISTS idx_travel_bookmarks_user ON travel_bookmarks(user_id);
