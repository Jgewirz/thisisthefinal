CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    message_type TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    rich_card_type TEXT,
    rich_card_data TEXT,
    created_at TEXT NOT NULL,
    message_order INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_agent_order
    ON chat_messages(user_id, agent_id, message_order);