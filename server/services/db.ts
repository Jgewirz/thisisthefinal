import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err);
});

/** Run the initial migration to create tables if they don't exist. */
export async function initDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        email         TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name          TEXT NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS style_profiles (
        user_id   TEXT PRIMARY KEY DEFAULT 'default',
        profile   JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL DEFAULT 'default',
        agent_id   TEXT NOT NULL,
        type       TEXT NOT NULL CHECK (type IN ('user', 'bot')),
        text       TEXT NOT NULL DEFAULT '',
        image_url  TEXT,
        rich_card  JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_chat_messages_user_agent
        ON chat_messages (user_id, agent_id, created_at);
    `);
    console.log('  ✓ Database tables ready');
  } catch (err: any) {
    console.error('DB migration error:', err.message);
    console.warn('  ⚠ Running without database — falling back to in-memory storage');
  } finally {
    client.release();
  }
}

// ─── Users ─────────────────────────────────────────────────

export async function createUser(
  email: string,
  passwordHash: string,
  name: string
): Promise<{ id: string; email: string; name: string } | null> {
  try {
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)',
      [id, email, passwordHash, name]
    );
    return { id, email, name };
  } catch (err: any) {
    console.error('createUser error:', err.message);
    return null;
  }
}

export async function getUserByEmail(
  email: string
): Promise<{ id: string; email: string; name: string; password_hash: string } | null> {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, name FROM users WHERE email = $1',
      [email]
    );
    return rows[0] || null;
  } catch (err: any) {
    console.error('getUserByEmail error:', err.message);
    return null;
  }
}

// ─── Style Profiles ────────────────────────────────────────

export async function getStyleProfile(userId = 'default'): Promise<object | null> {
  try {
    const { rows } = await pool.query(
      'SELECT profile FROM style_profiles WHERE user_id = $1',
      [userId]
    );
    return rows[0]?.profile ?? null;
  } catch (err: any) {
    console.error('getStyleProfile error:', err.message);
    return null;
  }
}

export async function saveStyleProfile(profile: object, userId = 'default'): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO style_profiles (user_id, profile, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET profile = $2, updated_at = NOW()`,
      [userId, JSON.stringify(profile)]
    );
    return true;
  } catch (err: any) {
    console.error('saveStyleProfile error:', err.message);
    return false;
  }
}

// ─── Chat Messages ─────────────────────────────────────────

export interface DbChatMessage {
  id: string;
  user_id: string;
  agent_id: string;
  type: 'user' | 'bot';
  text: string;
  image_url?: string;
  rich_card?: object;
  created_at: Date;
}

export async function saveChatMessage(msg: Omit<DbChatMessage, 'created_at'>): Promise<boolean> {
  try {
    // Strip large base64 images (>50KB) but allow small thumbnails through.
    const imageUrl = msg.image_url?.startsWith('data:') && msg.image_url.length > 50_000
      ? null
      : (msg.image_url ?? null);

    await pool.query(
      `INSERT INTO chat_messages (id, user_id, agent_id, type, text, image_url, rich_card)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET text = $5, rich_card = $7`,
      [msg.id, msg.user_id || 'default', msg.agent_id, msg.type, msg.text, imageUrl, msg.rich_card ? JSON.stringify(msg.rich_card) : null]
    );
    return true;
  } catch (err: any) {
    console.error('saveChatMessage error:', err.message);
    return false;
  }
}

export async function getChatHistory(
  agentId: string,
  userId = 'default',
  limit = 50,
  offset = 0
): Promise<DbChatMessage[]> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM chat_messages
       WHERE user_id = $1 AND agent_id = $2
       ORDER BY created_at ASC
       LIMIT $3 OFFSET $4`,
      [userId, agentId, limit, offset]
    );
    return rows;
  } catch (err: any) {
    console.error('getChatHistory error:', err.message);
    return [];
  }
}

export async function deleteChatMessages(agentId: string, userId: string): Promise<boolean> {
  try {
    await pool.query(
      'DELETE FROM chat_messages WHERE agent_id = $1 AND user_id = $2',
      [agentId, userId]
    );
    return true;
  } catch (err: any) {
    console.error('deleteChatMessages error:', err.message);
    return false;
  }
}

export async function deleteAllChatMessages(userId: string): Promise<boolean> {
  try {
    await pool.query('DELETE FROM chat_messages WHERE user_id = $1', [userId]);
    return true;
  } catch (err: any) {
    console.error('deleteAllChatMessages error:', err.message);
    return false;
  }
}

export { pool };
