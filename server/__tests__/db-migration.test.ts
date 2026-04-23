import { describe, it, expect, vi } from 'vitest';

vi.mock('pg', () => {
  const client = {
    query: vi.fn(async () => ({ rows: [] })),
    release: vi.fn(),
  };

  class Pool {
    on() {
      // no-op
    }
    async connect() {
      return client;
    }
  }

  return {
    default: { Pool },
    __client: client,
  };
});

describe('initDb migration', async () => {
  it('adds and backfills users.id for legacy schemas', async () => {
    const { initDb } = await import('../services/db.js');
    const pgMock = await import('pg');

    // @ts-expect-error - provided by our mock factory above
    const client = pgMock.__client as { query: ReturnType<typeof vi.fn> };
    client.query.mockClear();

    await initDb();

    const sqlCalls = client.query.mock.calls.map((c) => String(c[0]));
    expect(sqlCalls.join('\n')).toContain('ALTER TABLE users ADD COLUMN IF NOT EXISTS email');
    expect(sqlCalls.join('\n')).toContain('ALTER TABLE users ALTER COLUMN telegram_id SET DEFAULT');
    expect(sqlCalls.join('\n')).toContain('UPDATE users SET telegram_id');
    expect(sqlCalls.join('\n')).toContain('ALTER TABLE users ADD COLUMN IF NOT EXISTS id');
    expect(sqlCalls.join('\n')).toContain('UPDATE users SET id = gen_random_uuid()::text');
    // Wardrobe schema drift: legacy tables may have bigint user_id and missing columns.
    expect(sqlCalls.join('\n')).toContain('DROP CONSTRAINT');
    expect(sqlCalls.join('\n')).toContain('ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS subtype');
    expect(sqlCalls.join('\n')).toContain('ALTER TABLE wardrobe_items ALTER COLUMN user_id TYPE TEXT');
    expect(sqlCalls.join('\n')).toContain('FOREIGN KEY (user_id) REFERENCES users(id)');
  });
});

