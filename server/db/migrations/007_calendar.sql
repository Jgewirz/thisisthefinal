-- Calendar agent tables

-- User-created tasks/reminders
CREATE TABLE IF NOT EXISTS calendar_tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date TEXT NOT NULL,          -- ISO date YYYY-MM-DD
  due_time TEXT DEFAULT NULL,      -- HH:mm
  completed INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_tasks_user ON calendar_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_user_date ON calendar_tasks(user_id, due_date);

-- Google Calendar OAuth tokens (encrypted)
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  user_id TEXT PRIMARY KEY,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  token_expiry TEXT NOT NULL,
  calendar_id TEXT DEFAULT 'primary',
  connected_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
