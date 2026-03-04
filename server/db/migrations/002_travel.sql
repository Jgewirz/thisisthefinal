-- Travel bookmarks (saved flights, hotels, POIs)
CREATE TABLE IF NOT EXISTS travel_bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('flight', 'hotel', 'poi')),
  data TEXT NOT NULL DEFAULT '{}',
  label TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Travel search history
CREATE TABLE IF NOT EXISTS travel_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  intent_type TEXT NOT NULL CHECK (intent_type IN ('flight_search', 'hotel_search', 'poi_search')),
  params TEXT NOT NULL DEFAULT '{}',
  result_count INTEGER DEFAULT 0,
  searched_at TEXT DEFAULT (datetime('now'))
);

-- Travel preferences on user
ALTER TABLE users ADD COLUMN travel_home_airport TEXT;
ALTER TABLE users ADD COLUMN travel_preferred_cabin TEXT DEFAULT 'ECONOMY';
ALTER TABLE users ADD COLUMN travel_preferred_currency TEXT DEFAULT 'USD';
