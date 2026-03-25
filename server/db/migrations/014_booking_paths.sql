-- Learned navigation paths for browser-use booking agent.
-- Stores successful step sequences per studio domain so repeat bookings are faster.

CREATE TABLE IF NOT EXISTS booking_paths (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,                    -- e.g. "soul-cycle.com"
  studio_name TEXT,                        -- human-readable studio name
  path_type TEXT NOT NULL DEFAULT 'fitness', -- 'fitness' | 'flight' | 'dining'
  navigation_steps TEXT NOT NULL,          -- JSON array of step descriptions
  success_count INTEGER NOT NULL DEFAULT 1,
  fail_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_paths_domain ON booking_paths(domain, path_type);
CREATE INDEX IF NOT EXISTS idx_booking_paths_success ON booking_paths(success_count DESC);
