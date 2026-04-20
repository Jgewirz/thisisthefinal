import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pg', () => {
  const query = vi.fn(async () => ({ rows: [] }));

  class Pool {
    on() {
      // no-op
    }
    async query(sql: string, params?: any[]) {
      return query(sql, params);
    }
    async connect() {
      return { query, release: vi.fn() };
    }
  }

  return {
    default: { Pool },
    __query: query,
  };
});

describe('getChatHistory', async () => {
  beforeEach(async () => {
    const pgMock = await import('pg');
    // @ts-expect-error - from mock
    (pgMock.__query as any).mockClear();
  });

  it('when agentId=all, queries across all agent_ids for the user', async () => {
    const { getChatHistory } = await import('../services/db.js');
    const pgMock = await import('pg');
    // @ts-expect-error - from mock
    const query = pgMock.__query as ReturnType<typeof vi.fn>;

    await getChatHistory('all', 'u1', 50, 0);
    expect(query).toHaveBeenCalledOnce();
    const [sql, params] = query.mock.calls[0]!;
    expect(String(sql)).toContain('WHERE user_id = $1');
    expect(String(sql)).not.toContain('agent_id = $2');
    expect(params).toEqual(['u1', 50, 0]);
  });

  it('when agentId is a specialist, filters by agent_id', async () => {
    const { getChatHistory } = await import('../services/db.js');
    const pgMock = await import('pg');
    // @ts-expect-error - from mock
    const query = pgMock.__query as ReturnType<typeof vi.fn>;
    query.mockClear();

    await getChatHistory('travel', 'u1', 50, 10);
    const [sql, params] = query.mock.calls[0]!;
    expect(String(sql)).toContain('WHERE user_id = $1 AND agent_id = $2');
    expect(params).toEqual(['u1', 'travel', 50, 10]);
  });
});

