-- Extended travel preferences
ALTER TABLE users ADD COLUMN travel_max_price INTEGER;
ALTER TABLE users ADD COLUMN travel_preferred_airlines TEXT DEFAULT '[]';
ALTER TABLE users ADD COLUMN travel_excluded_airlines TEXT DEFAULT '[]';

-- Recreate travel_searches to support cheapest_dates intent type
-- SQLite doesn't support ALTER CHECK, so we drop and recreate
DROP TABLE IF EXISTS travel_searches;
CREATE TABLE IF NOT EXISTS travel_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  intent_type TEXT NOT NULL CHECK (intent_type IN ('flight_search', 'hotel_search', 'poi_search', 'cheapest_dates')),
  params TEXT NOT NULL DEFAULT '{}',
  result_count INTEGER DEFAULT 0,
  searched_at TEXT DEFAULT (datetime('now'))
);
