-- Per-user credentials for external booking services (Resy, OpenTable, Mindbody, etc.)

CREATE TABLE IF NOT EXISTS user_service_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    service TEXT NOT NULL,

    -- Credentials
    auth_token TEXT,
    refresh_token TEXT,
    token_expiry TEXT,

    -- Service-specific user info
    service_user_id TEXT,
    service_email TEXT,
    payment_method_id TEXT,
    service_metadata TEXT DEFAULT '{}',

    -- State
    status TEXT NOT NULL DEFAULT 'active',
    linked_at TEXT DEFAULT (datetime('now')),
    last_used TEXT,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, service)
);

CREATE INDEX IF NOT EXISTS idx_service_accounts_user ON user_service_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_service_accounts_service ON user_service_accounts(service, status);
