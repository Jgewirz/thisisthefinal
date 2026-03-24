ALTER TABLE users ADD COLUMN google_id TEXT;
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'anonymous';
ALTER TABLE users ADD COLUMN last_login_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
