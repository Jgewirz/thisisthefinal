-- Studio schedule cache — stores enriched class schedules from website scraping
-- Entries expire after 24 hours to keep schedules fresh

CREATE TABLE IF NOT EXISTS studio_schedule_cache (
  place_id TEXT PRIMARY KEY,
  studio_name TEXT NOT NULL,
  classes_json TEXT NOT NULL DEFAULT '[]',  -- JSON array of StudioClass objects
  source_url TEXT,                          -- website URL that was scraped
  fetched_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT DEFAULT (datetime('now', '+24 hours'))
);

CREATE INDEX IF NOT EXISTS idx_studio_cache_expires ON studio_schedule_cache(expires_at);
