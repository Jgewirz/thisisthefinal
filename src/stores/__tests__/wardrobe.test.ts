import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/wardrobeApi', () => ({
  listWardrobe: vi.fn(),
  createWardrobeItem: vi.fn(),
  updateWardrobeItem: vi.fn(),
  deleteWardrobeItem: vi.fn(),
}));

import * as api from '../../lib/wardrobeApi';
import { useWardrobeStore } from '../wardrobe';

const apiMock = api as unknown as {
  listWardrobe: ReturnType<typeof vi.fn>;
  createWardrobeItem: ReturnType<typeof vi.fn>;
  updateWardrobeItem: ReturnType<typeof vi.fn>;
  deleteWardrobeItem: ReturnType<typeof vi.fn>;
};

function mkItem(overrides: Partial<api.WardrobeItem> = {}): api.WardrobeItem {
  return {
    id: 'w1',
    user_id: 'u1',
    image_url: null,
    category: 'top',
    subtype: null,
    color: 'black',
    color_hex: null,
    pattern: null,
    seasons: [],
    occasions: [],
    warmth: null,
    attributes: {},
    created_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  apiMock.listWardrobe.mockReset();
  apiMock.createWardrobeItem.mockReset();
  apiMock.updateWardrobeItem.mockReset();
  apiMock.deleteWardrobeItem.mockReset();
  useWardrobeStore.getState()._setForTests({ byId: {}, loaded: false, loading: false, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('load', () => {
  it('fetches once and indexes by id', async () => {
    apiMock.listWardrobe.mockResolvedValueOnce([mkItem({ id: 'a' }), mkItem({ id: 'b' })]);
    await useWardrobeStore.getState().load();
    const byId = useWardrobeStore.getState().byId;
    expect(Object.keys(byId).sort()).toEqual(['a', 'b']);
    expect(useWardrobeStore.getState().loaded).toBe(true);
  });

  it('skips refetch when already loaded unless forced', async () => {
    apiMock.listWardrobe.mockResolvedValue([mkItem()]);
    await useWardrobeStore.getState().load();
    await useWardrobeStore.getState().load();
    expect(apiMock.listWardrobe).toHaveBeenCalledTimes(1);
    await useWardrobeStore.getState().load(true);
    expect(apiMock.listWardrobe).toHaveBeenCalledTimes(2);
  });

  it('captures errors without crashing', async () => {
    apiMock.listWardrobe.mockRejectedValueOnce(new Error('boom'));
    await useWardrobeStore.getState().load();
    expect(useWardrobeStore.getState().error).toMatch(/boom/);
    expect(useWardrobeStore.getState().loaded).toBe(false);
  });
});

describe('add', () => {
  it('inserts the server-returned item and returns it', async () => {
    const created = mkItem({ id: 'new', color: 'red' });
    apiMock.createWardrobeItem.mockResolvedValueOnce(created);
    const out = await useWardrobeStore
      .getState()
      .add({ category: 'top', color: 'red' }, 'photo-42');
    expect(out?.id).toBe('new');
    expect(useWardrobeStore.getState().byId['new']).toEqual(created);
    expect(apiMock.createWardrobeItem).toHaveBeenCalledWith(
      { category: 'top', color: 'red' },
      'photo-42'
    );
  });

  it('records an error on failure and leaves state unchanged', async () => {
    apiMock.createWardrobeItem.mockResolvedValueOnce(null);
    const out = await useWardrobeStore.getState().add({ category: 'top' });
    expect(out).toBeNull();
    expect(Object.keys(useWardrobeStore.getState().byId)).toEqual([]);
    expect(useWardrobeStore.getState().error).toMatch(/add/i);
  });
});

describe('patch (optimistic)', () => {
  it('applies the patch immediately, reconciles with server row on success', async () => {
    useWardrobeStore
      .getState()
      ._setForTests({ byId: { w1: mkItem({ id: 'w1', color: 'black' }) } });

    // Hold the API promise open so we can assert the optimistic state mid-flight.
    let resolvePatch: (v: api.WardrobeItem | null) => void = () => {};
    apiMock.updateWardrobeItem.mockReturnValueOnce(
      new Promise((r) => {
        resolvePatch = r;
      })
    );

    const pending = useWardrobeStore.getState().patch('w1', { color: 'red' });
    expect(useWardrobeStore.getState().byId['w1'].color).toBe('red');

    resolvePatch(mkItem({ id: 'w1', color: 'crimson' }));
    await pending;
    expect(useWardrobeStore.getState().byId['w1'].color).toBe('crimson');
  });

  it('rolls back to the previous item when the server rejects', async () => {
    const prev = mkItem({ id: 'w1', color: 'black' });
    useWardrobeStore.getState()._setForTests({ byId: { w1: prev } });
    apiMock.updateWardrobeItem.mockResolvedValueOnce(null);

    const ok = await useWardrobeStore.getState().patch('w1', { color: 'red' });
    expect(ok).toBe(false);
    expect(useWardrobeStore.getState().byId['w1']).toEqual(prev);
    expect(useWardrobeStore.getState().error).toMatch(/update/i);
  });

  it('is a no-op (returns false) when the id is unknown', async () => {
    const ok = await useWardrobeStore.getState().patch('missing', { color: 'red' });
    expect(ok).toBe(false);
    expect(apiMock.updateWardrobeItem).not.toHaveBeenCalled();
  });
});

describe('remove (optimistic)', () => {
  it('removes immediately and commits on success', async () => {
    useWardrobeStore.getState()._setForTests({ byId: { w1: mkItem({ id: 'w1' }) } });
    apiMock.deleteWardrobeItem.mockResolvedValueOnce(true);
    const ok = await useWardrobeStore.getState().remove('w1');
    expect(ok).toBe(true);
    expect(useWardrobeStore.getState().byId['w1']).toBeUndefined();
  });

  it('rolls back on server failure', async () => {
    const prev = mkItem({ id: 'w1' });
    useWardrobeStore.getState()._setForTests({ byId: { w1: prev } });
    apiMock.deleteWardrobeItem.mockResolvedValueOnce(false);
    const ok = await useWardrobeStore.getState().remove('w1');
    expect(ok).toBe(false);
    expect(useWardrobeStore.getState().byId['w1']).toEqual(prev);
    expect(useWardrobeStore.getState().error).toMatch(/delete/i);
  });

  it('returns false when the id is unknown', async () => {
    const ok = await useWardrobeStore.getState().remove('missing');
    expect(ok).toBe(false);
    expect(apiMock.deleteWardrobeItem).not.toHaveBeenCalled();
  });
});

describe('selectors', () => {
  it('list() sorts by created_at DESC', () => {
    useWardrobeStore.getState()._setForTests({
      byId: {
        a: mkItem({ id: 'a', created_at: '2026-01-01T00:00:00.000Z' }),
        b: mkItem({ id: 'b', created_at: '2026-03-01T00:00:00.000Z' }),
        c: mkItem({ id: 'c', created_at: '2026-02-01T00:00:00.000Z' }),
      },
    });
    expect(useWardrobeStore.getState().list().map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('byCategory() filters in memory', () => {
    useWardrobeStore.getState()._setForTests({
      byId: {
        a: mkItem({ id: 'a', category: 'top' }),
        b: mkItem({ id: 'b', category: 'shoes' }),
      },
    });
    expect(
      useWardrobeStore
        .getState()
        .byCategory('shoes')
        .map((x) => x.id)
    ).toEqual(['b']);
  });
});
