import pg from 'pg';
// import { errorMessage } from '../utils/errors.js';

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

export const DB_MIGRATION_STEPS = {
  ensureUuidExtension: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`,
  createTables: `
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS style_profiles (
      user_id    TEXT PRIMARY KEY DEFAULT 'default',
      profile    JSONB NOT NULL,
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

    CREATE TABLE IF NOT EXISTS reminders (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      agent_id    TEXT NOT NULL DEFAULT 'lifestyle',
      title       TEXT NOT NULL,
      notes       TEXT,
      due_at      TIMESTAMPTZ NOT NULL,
      notify_via  TEXT NOT NULL DEFAULT 'in_app'
                  CHECK (notify_via IN ('in_app', 'email', 'push')),
      status      TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'fired', 'completed', 'dismissed')),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fired_at    TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_reminders_user_status_due
      ON reminders (user_id, status, due_at);

    CREATE TABLE IF NOT EXISTS saved_items (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL,
      kind         TEXT NOT NULL CHECK (
                     kind IN ('hotel', 'flight', 'place', 'studio', 'reminder')
                   ),
      external_id  TEXT NOT NULL,
      data         JSONB NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, kind, external_id)
    );

    CREATE INDEX IF NOT EXISTS idx_saved_items_user_kind
      ON saved_items (user_id, kind, created_at DESC);

    -- Phase 1 of the Style agent: persistent wardrobe. Tags that the outfit
    -- builder relies on (category/season/occasion/warmth) live as real columns
    -- so we can query + index them; free-form extras go in attributes JSONB.
    CREATE TABLE IF NOT EXISTS wardrobe_items (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      image_url   TEXT,
      category    TEXT NOT NULL CHECK (
                    category IN ('top','bottom','dress','outerwear','shoes','accessory','activewear')
                  ),
      subtype     TEXT,
      color       TEXT,
      color_hex   TEXT,
      pattern     TEXT,
      seasons     TEXT[] NOT NULL DEFAULT '{}'::text[],
      occasions   TEXT[] NOT NULL DEFAULT '{}'::text[],
      warmth      TEXT CHECK (warmth IS NULL OR warmth IN ('light','medium','heavy')),
      attributes  JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_wardrobe_user_category
      ON wardrobe_items (user_id, category, created_at DESC);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      token_hash  TEXT NOT NULL UNIQUE,
      expires_at  TIMESTAMPTZ NOT NULL,
      used_at     TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
      ON password_reset_tokens (user_id);
  `,
  // Existing projects may have a legacy `users` table without an `id` column.
  // Migrate it forward without dropping data.
  migrateUsersIdColumn: `
    -- Legacy schemas may be missing required columns entirely. Add them first.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

    -- Some legacy schemas include telegram auth columns with NOT NULL constraints.
    -- This app doesn't supply those fields, so we must relax the constraint.
    DO $$
    DECLARE telegram_type TEXT;
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'telegram_id'
      ) THEN
        -- If telegram_id exists, ensure inserts that omit it still work by
        -- backfilling NULLs and setting a DEFAULT. We only drop NOT NULL when
        -- telegram_id is not part of the primary key.
        SELECT data_type
          INTO telegram_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'telegram_id';

        IF telegram_type IN ('bigint', 'integer', 'smallint') THEN
          EXECUTE 'CREATE SEQUENCE IF NOT EXISTS users_telegram_id_seq';
          EXECUTE 'ALTER TABLE users ALTER COLUMN telegram_id SET DEFAULT nextval(''users_telegram_id_seq'')';
          EXECUTE 'UPDATE users SET telegram_id = nextval(''users_telegram_id_seq'') WHERE telegram_id IS NULL';
        ELSE
          EXECUTE 'ALTER TABLE users ALTER COLUMN telegram_id SET DEFAULT gen_random_uuid()::text';
          EXECUTE 'UPDATE users SET telegram_id = gen_random_uuid()::text WHERE telegram_id IS NULL';
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN unnest(c.conkey) AS colnum(attnum) ON TRUE
          JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = colnum.attnum
          WHERE c.conrelid = 'users'::regclass
            AND c.contype = 'p'
            AND a.attname = 'telegram_id'
        ) THEN
          EXECUTE 'ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL';
        END IF;
      END IF;
    END $$;

    ALTER TABLE users ADD COLUMN IF NOT EXISTS id TEXT;
    UPDATE users SET id = gen_random_uuid()::text WHERE id IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_id_unique ON users (id);

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conrelid = 'users'::regclass
          AND c.contype = 'p'
      ) THEN
        ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
      END IF;
    END $$;

    -- Only add an email unique index when the column exists (it will) and has values.
    -- If legacy rows have NULL emails, a UNIQUE index is still valid in Postgres (multiple NULLs allowed).
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (email);
  `,
  /**
   * Legacy schemas may already have a `wardrobe_items` table with different
   * column types (e.g. bigint user_id) or missing columns. Make it compatible
   * with the current app contract without dropping data.
   */
  migrateWardrobeItemsSchema: `
    -- Legacy schemas may have an incompatible FK (e.g. bigint user_id → users.telegram_id).
    -- Drop any FK constraints on wardrobe_items.user_id so we can fix types/columns.
    DO $$
    DECLARE c RECORD;
    BEGIN
      FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'wardrobe_items'::regclass
          AND contype = 'f'
          AND pg_get_constraintdef(oid) LIKE '%(user_id)%'
      LOOP
        EXECUTE format('ALTER TABLE wardrobe_items DROP CONSTRAINT IF EXISTS %I', c.conname);
      END LOOP;
    END $$;

    -- Add missing columns first (safe no-ops when already present).
    ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS image_url TEXT;
    ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS category TEXT;
    ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS subtype TEXT;
    ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS color TEXT;
    ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS color_hex TEXT;
    ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS pattern TEXT;
    ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS seasons TEXT[] NOT NULL DEFAULT '{}'::text[];
    ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS occasions TEXT[] NOT NULL DEFAULT '{}'::text[];
    ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS warmth TEXT;
    ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    -- Coerce id/user_id to TEXT when legacy tables used numeric ids.
    DO $$
    DECLARE id_type TEXT;
    DECLARE user_type TEXT;
    BEGIN
      SELECT data_type INTO id_type
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='wardrobe_items' AND column_name='id';

      IF id_type IS NOT NULL AND id_type <> 'text' THEN
        EXECUTE 'ALTER TABLE wardrobe_items ALTER COLUMN id TYPE TEXT USING id::text';
      END IF;

      SELECT data_type INTO user_type
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='wardrobe_items' AND column_name='user_id';

      IF user_type IS NOT NULL AND user_type <> 'text' THEN
        EXECUTE 'ALTER TABLE wardrobe_items ALTER COLUMN user_id TYPE TEXT USING user_id::text';
      END IF;
    END $$;

    -- Backfill category if it was nullable historically.
    UPDATE wardrobe_items SET category = 'top' WHERE category IS NULL;

    -- Enforce current constraints going forward.
    ALTER TABLE wardrobe_items ALTER COLUMN id SET NOT NULL;
    ALTER TABLE wardrobe_items ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE wardrobe_items ALTER COLUMN category SET NOT NULL;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'wardrobe_items'::regclass
          AND contype = 'c'
          AND conname = 'wardrobe_items_category_check'
      ) THEN
        ALTER TABLE wardrobe_items
          ADD CONSTRAINT wardrobe_items_category_check
          CHECK (category IN ('top','bottom','dress','outerwear','shoes','accessory','activewear'));
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_wardrobe_user_category
      ON wardrobe_items (user_id, category, created_at DESC);

    -- Re-add the correct FK (TEXT → users.id TEXT). Only add when missing.
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'wardrobe_items'::regclass
          AND contype = 'f'
          AND conname = 'wardrobe_items_user_id_fk'
      ) THEN
        ALTER TABLE wardrobe_items
          ADD CONSTRAINT wardrobe_items_user_id_fk
          FOREIGN KEY (user_id) REFERENCES users(id)
          ON DELETE CASCADE;
      END IF;
    END $$;
  `,
} as const;

/** Run the initial migration to create tables if they don't exist. */
export async function initDb(): Promise<void> {
  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : String(err);
    console.error('DB connection error:', msg);
    console.warn('  ⚠ Running without database — falling back to in-memory storage');
    return;
  }
  try {
    await client.query('BEGIN');
    await client.query(DB_MIGRATION_STEPS.ensureUuidExtension);
    await client.query(DB_MIGRATION_STEPS.createTables);
    await client.query(DB_MIGRATION_STEPS.migrateUsersIdColumn);
    await client.query(DB_MIGRATION_STEPS.migrateWardrobeItemsSchema);
    await client.query('COMMIT');
    console.log('  ✓ Database tables ready');
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failures
    }
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

export async function updateUserPassword(
  userId: string,
  passwordHash: string
): Promise<boolean> {
  try {
    const res = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, userId]
    );
    return (res.rowCount ?? 0) > 0;
  } catch (err: any) {
    console.error('updateUserPassword error:', err.message);
    return false;
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
    // The "All" agent is a combined timeline across specialists.
    // Bot messages sent from the All tab may be persisted under the classified specialist
    // (`travel`, `fitness`, etc.), so the All timeline must fetch across agent ids.
    const { rows } =
      agentId === 'all'
        ? await pool.query(
            `SELECT * FROM chat_messages
             WHERE user_id = $1
             ORDER BY created_at ASC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
          )
        : await pool.query(
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
