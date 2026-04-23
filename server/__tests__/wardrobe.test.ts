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

const sampleRow = {
  id: 'w1',
  user_id: 'u1',
  image_url: null,
  category: 'top',
  subtype: 'tshirt',
  color: 'black',
  color_hex: '#000000',
  pattern: null,
  seasons: ['spring', 'summer'],
  occasions: ['casual'],
  warmth: 'light',
  attributes: {},
  created_at: new Date('2026-05-01T00:00:00Z'),
};

describe('createWardrobeItem', () => {
  it('rejects unknown category before touching the DB', async () => {
    const { createWardrobeItem } = await import('../services/wardrobe.js');
    await expect(
      createWardrobeItem({
        userId: 'u1',
        // @ts-expect-error — intentionally invalid
        category: 'airplane',
      })
    ).rejects.toThrow(/invalid category/i);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects unknown season', async () => {
    const { createWardrobeItem } = await import('../services/wardrobe.js');
    await expect(
      createWardrobeItem({
        userId: 'u1',
        category: 'top',
        // @ts-expect-error
        seasons: ['monsoon'],
      })
    ).rejects.toThrow(/invalid season/i);
  });

  it('rejects unknown warmth', async () => {
    const { createWardrobeItem } = await import('../services/wardrobe.js');
    await expect(
      createWardrobeItem({
        userId: 'u1',
        category: 'top',
        // @ts-expect-error
        warmth: 'nuclear',
      })
    ).rejects.toThrow(/invalid warmth/i);
  });

  it('accepts a large base64 data URL for imageUrl (photos from chat are huge)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [sampleRow] });
    const { createWardrobeItem } = await import('../services/wardrobe.js');
    // ~1 MB of base64 payload — representative of a real uploaded photo.
    const big = `data:image/png;base64,${'A'.repeat(1_000_000)}`;
    await expect(
      createWardrobeItem({ userId: 'u1', category: 'top', imageUrl: big })
    ).resolves.toBeTruthy();
    expect(queryMock).toHaveBeenCalledOnce();
    const params = queryMock.mock.calls[0][1];
    expect(params[2]).toBe(big);
  });

  it('rejects image URLs above the hard ceiling to keep DB bloat bounded', async () => {
    const { createWardrobeItem } = await import('../services/wardrobe.js');
    const tooBig = 'x'.repeat(13 * 1024 * 1024);
    await expect(
      createWardrobeItem({ userId: 'u1', category: 'top', imageUrl: tooBig })
    ).rejects.toThrow(/imageUrl: max/);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('caps occasions array length and lowercases entries', async () => {
    const { createWardrobeItem } = await import('../services/wardrobe.js');
    await expect(
      createWardrobeItem({
        userId: 'u1',
        category: 'top',
        occasions: Array.from({ length: 11 }, (_, i) => `Occ${i}`),
      })
    ).rejects.toThrow(/max 10/i);
  });

  it('inserts with defaults and returns the resulting row', async () => {
    queryMock.mockResolvedValueOnce({ rows: [sampleRow] });
    const { createWardrobeItem } = await import('../services/wardrobe.js');
    const out = await createWardrobeItem({
      userId: 'u1',
      category: 'top',
      color: 'Black',
      occasions: ['Casual', 'casual'], // dedupe + lowercase
    });
    expect(queryMock).toHaveBeenCalledOnce();
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO wardrobe_items/);
    expect(params[1]).toBe('u1');
    expect(params[3]).toBe('top');
    expect(params[5]).toBe('Black'); // color trimmed but case preserved
    expect(params[8]).toEqual([]); // seasons default
    expect(params[9]).toEqual(['casual']); // deduped + lowercased
    expect(out).toMatchObject({ id: 'w1', category: 'top', color: 'black' });
    expect(out.created_at).toBe('2026-05-01T00:00:00.000Z');
  });
});

describe('listWardrobeItems', () => {
  it('filters by category when provided', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const { listWardrobeItems } = await import('../services/wardrobe.js');
    await listWardrobeItems('u1', { category: 'shoes' });
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/WHERE user_id = \$1 AND category = \$2/);
    expect(params).toEqual(['u1', 'shoes', 100]);
  });

  it('returns all categories when unspecified, owner-scoped', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const { listWardrobeItems } = await import('../services/wardrobe.js');
    await listWardrobeItems('u1');
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/WHERE user_id = \$1/);
    expect(sql).not.toMatch(/category = \$2/);
    expect(params).toEqual(['u1', 100]);
  });

  it('clamps limit into [1, 500]', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const { listWardrobeItems } = await import('../services/wardrobe.js');
    await listWardrobeItems('u1', { limit: 0 });
    expect(queryMock.mock.calls[0][1]).toEqual(['u1', 1]);
    await listWardrobeItems('u1', { limit: 9999 });
    expect(queryMock.mock.calls[1][1]).toEqual(['u1', 500]);
  });
});

describe('updateWardrobeItem', () => {
  it('no-ops on empty patch and returns the current row', async () => {
    queryMock.mockResolvedValueOnce({ rows: [sampleRow] });
    const { updateWardrobeItem } = await import('../services/wardrobe.js');
    const out = await updateWardrobeItem('w1', 'u1', {});
    expect(out?.id).toBe('w1');
    const [sql] = queryMock.mock.calls[0];
    expect(sql).toMatch(/SELECT \* FROM wardrobe_items WHERE id = \$1 AND user_id = \$2/);
  });

  it('builds SET clause only for provided fields and scopes to owner', async () => {
    queryMock.mockResolvedValueOnce({ rows: [sampleRow] });
    const { updateWardrobeItem } = await import('../services/wardrobe.js');
    await updateWardrobeItem('w1', 'u1', {
      color: 'Charcoal',
      seasons: ['winter'],
    });
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/UPDATE wardrobe_items\s+SET color = \$3, seasons = \$4::text\[\]/);
    expect(sql).toMatch(/WHERE id = \$1 AND user_id = \$2/);
    expect(params[0]).toBe('w1');
    expect(params[1]).toBe('u1');
    expect(params[2]).toBe('Charcoal');
    expect(params[3]).toEqual(['winter']);
  });

  it('returns null when nothing matched (wrong owner or missing)', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const { updateWardrobeItem } = await import('../services/wardrobe.js');
    const out = await updateWardrobeItem('w-missing', 'u2', { color: 'red' });
    expect(out).toBeNull();
  });
});

describe('deleteWardrobeItem', () => {
  it('owner-scopes the delete and reports whether a row was removed', async () => {
    queryMock.mockResolvedValueOnce({ rowCount: 1 });
    const { deleteWardrobeItem } = await import('../services/wardrobe.js');
    expect(await deleteWardrobeItem('w1', 'u1')).toBe(true);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM wardrobe_items WHERE id = \$1 AND user_id = \$2/);
    expect(params).toEqual(['w1', 'u1']);

    queryMock.mockResolvedValueOnce({ rowCount: 0 });
    expect(await deleteWardrobeItem('missing', 'u1')).toBe(false);
  });
});
