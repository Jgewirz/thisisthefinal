import { describe, it, expect, vi } from 'vitest';

vi.mock('pg', () => {
  class Pool {
    on() {
      // no-op
    }
    async connect() {
      throw new Error('connect ETIMEDOUT 1.2.3.4:5432');
    }
  }

  return {
    default: { Pool },
  };
});

describe('initDb fail-open on connection errors', () => {
  it('does not throw when the database is unreachable', async () => {
    const { initDb } = await import('../services/db.js');
    await expect(initDb()).resolves.toBeUndefined();
  });
});

