import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
vi.mock('../services/db.js', () => ({
  pool: { query: queryMock },
}));

beforeEach(() => {
  queryMock.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('saveItem', () => {
  it('rejects unknown kinds before touching the DB', async () => {
    const { saveItem } = await import('../services/savedItems.js');
    await expect(
      // @ts-expect-error — intentionally invalid kind
      saveItem({ userId: 'u1', kind: 'airplane', externalId: 'x', data: {} })
    ).rejects.toThrow(/invalid/i);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects missing / oversize externalId', async () => {
    const { saveItem } = await import('../services/savedItems.js');
    await expect(
      saveItem({ userId: 'u1', kind: 'hotel', externalId: '', data: {} })
    ).rejects.toThrow(/externalId/i);
    await expect(
      saveItem({
        userId: 'u1',
        kind: 'hotel',
        externalId: 'a'.repeat(257),
        data: {},
      })
    ).rejects.toThrow(/externalId/i);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('uses ON CONFLICT upsert and returns the resulting row', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 'abc',
          user_id: 'u1',
          kind: 'hotel',
          external_id: 'h-42',
          data: { name: 'Grand' },
          created_at: new Date('2026-05-01T00:00:00Z'),
        },
      ],
    });
    const { saveItem } = await import('../services/savedItems.js');
    const out = await saveItem({
      userId: 'u1',
      kind: 'hotel',
      externalId: 'h-42',
      data: { name: 'Grand' },
    });
    expect(queryMock).toHaveBeenCalledOnce();
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO saved_items/);
    expect(sql).toMatch(/ON CONFLICT .*user_id, kind, external_id/);
    expect(params.slice(1)).toEqual(['u1', 'hotel', 'h-42', JSON.stringify({ name: 'Grand' })]);
    expect(out).toMatchObject({
      id: 'abc',
      kind: 'hotel',
      external_id: 'h-42',
      data: { name: 'Grand' },
    });
    expect(out.created_at).toBe('2026-05-01T00:00:00.000Z');
  });
});

describe('listSavedItems', () => {
  it('filters by kind when provided', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const { listSavedItems } = await import('../services/savedItems.js');
    await listSavedItems('u1', 'hotel');
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/WHERE user_id = \$1 AND kind = \$2/);
    expect(params).toEqual(['u1', 'hotel']);
  });

  it('returns all kinds when unspecified, scoped to owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const { listSavedItems } = await import('../services/savedItems.js');
    await listSavedItems('u1');
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/WHERE user_id = \$1/);
    expect(sql).not.toMatch(/kind = \$2/);
    expect(params).toEqual(['u1']);
  });
});

describe('delete helpers', () => {
  it('deleteSavedItem is owner-scoped and returns true only when a row matched', async () => {
    queryMock.mockResolvedValueOnce({ rowCount: 1 });
    const { deleteSavedItem } = await import('../services/savedItems.js');
    expect(await deleteSavedItem('id-x', 'u1')).toBe(true);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM saved_items WHERE id = \$1 AND user_id = \$2/);
    expect(params).toEqual(['id-x', 'u1']);

    queryMock.mockResolvedValueOnce({ rowCount: 0 });
    expect(await deleteSavedItem('missing', 'u1')).toBe(false);
  });

  it('deleteSavedItemByExternal filters by (user, kind, external_id)', async () => {
    queryMock.mockResolvedValueOnce({ rowCount: 1 });
    const { deleteSavedItemByExternal } = await import('../services/savedItems.js');
    expect(await deleteSavedItemByExternal('u1', 'hotel', 'h-42')).toBe(true);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/WHERE user_id = \$1 AND kind = \$2 AND external_id = \$3/);
    expect(params).toEqual(['u1', 'hotel', 'h-42']);
  });
});
