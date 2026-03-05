-- Fitness agent tables

CREATE TABLE IF NOT EXISTS fitness_bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,        -- 'class'
  data TEXT NOT NULL,        -- JSON blob
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS fitness_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  intent_type TEXT NOT NULL,  -- 'class_search'
  params TEXT NOT NULL,       -- JSON blob
  result_count INTEGER DEFAULT 0,
  searched_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS fitness_schedule (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,        -- 'class'
  data TEXT NOT NULL,        -- JSON blob
  label TEXT NOT NULL DEFAULT '',
  selected_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
