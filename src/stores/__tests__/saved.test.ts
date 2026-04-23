import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/savedApi', () => ({
  listSavedItems: vi.fn(),
  saveItem: vi.fn(),
  unsaveItem: vi.fn(),
}));

import { useSavedStore } from '../saved';
import * as api from '../../lib/savedApi';

const mocked = api as unknown as {
  listSavedItems: ReturnType<typeof vi.fn>;
  saveItem: ReturnType<typeof vi.fn>;
  unsaveItem: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  mocked.listSavedItems.mockReset();
  mocked.saveItem.mockReset();
  mocked.unsaveItem.mockReset();
  useSavedStore.setState({ byKey: {}, loadedKinds: new Set(), loading: false });
});

describe('useSavedStore', () => {
  it('loadKind caches after first load so repeat calls are no-ops', async () => {
    mocked.listSavedItems.mockResolvedValue([]);
    await useSavedStore.getState().loadKind('hotel');
    await useSavedStore.getState().loadKind('hotel');
    expect(mocked.listSavedItems).toHaveBeenCalledTimes(1);
  });

  it('save flips state optimistically and persists the server row', async () => {
    mocked.saveItem.mockResolvedValue({
      id: 'row-1',
      user_id: 'u',
      kind: 'hotel',
      external_id: 'h1',
      data: { name: 'Nice' },
      created_at: '2026-01-01T00:00:00Z',
    });
    const p = useSavedStore.getState().save('hotel', 'h1', { name: 'Nice' });
    // Before the promise resolves, state already shows it as saved (optimistic).
    expect(useSavedStore.getState().isSaved('hotel', 'h1')).toBe(true);
    const ok = await p;
    expect(ok).toBe(true);
    expect(useSavedStore.getState().byKey['hotel:h1'].id).toBe('row-1');
  });

  it('save rolls back when the API rejects', async () => {
    mocked.saveItem.mockResolvedValue(null);
    const ok = await useSavedStore.getState().save('flight', 'f9', { a: 1 });
    expect(ok).toBe(false);
    expect(useSavedStore.getState().isSaved('flight', 'f9')).toBe(false);
  });

  it('unsave removes row optimistically and restores on API failure', async () => {
    useSavedStore.setState({
      byKey: {
        'hotel:h2': {
          id: 'row-2',
          user_id: 'u',
          kind: 'hotel',
          external_id: 'h2',
          data: {},
          created_at: 'x',
        },
      },
    });
    mocked.unsaveItem.mockResolvedValue(false);
    const ok = await useSavedStore.getState().unsave('hotel', 'h2');
    expect(ok).toBe(false);
    expect(useSavedStore.getState().isSaved('hotel', 'h2')).toBe(true);
  });

  it('unsave keeps row removed when API reports success', async () => {
    useSavedStore.setState({
      byKey: {
        'hotel:h3': {
          id: 'row-3',
          user_id: 'u',
          kind: 'hotel',
          external_id: 'h3',
          data: {},
          created_at: 'x',
        },
      },
    });
    mocked.unsaveItem.mockResolvedValue(true);
    await useSavedStore.getState().unsave('hotel', 'h3');
    expect(useSavedStore.getState().isSaved('hotel', 'h3')).toBe(false);
  });
});
