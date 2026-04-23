import { create } from 'zustand';
import {
  listSavedItems,
  saveItem as apiSaveItem,
  unsaveItem as apiUnsaveItem,
  type SavedItem,
  type SavedItemKind,
} from '../lib/savedApi';

interface SavedState {
  /** Indexed by natural key `${kind}:${externalId}` → SavedItem. */
  byKey: Record<string, SavedItem>;
  loadedKinds: Set<SavedItemKind>;
  loading: boolean;

  keyOf: (kind: SavedItemKind, externalId: string) => string;
  isSaved: (kind: SavedItemKind, externalId: string) => boolean;

  loadKind: (kind: SavedItemKind) => Promise<void>;
  save: (
    kind: SavedItemKind,
    externalId: string,
    data: Record<string, unknown>
  ) => Promise<boolean>;
  unsave: (kind: SavedItemKind, externalId: string) => Promise<boolean>;

  /** Test hook to seed store state deterministically. */
  _setForTests: (next: Partial<SavedState>) => void;
}

const key = (kind: SavedItemKind, externalId: string) => `${kind}:${externalId}`;

export const useSavedStore = create<SavedState>((set, get) => ({
  byKey: {},
  loadedKinds: new Set(),
  loading: false,

  keyOf: key,

  isSaved(kind, externalId) {
    return Boolean(get().byKey[key(kind, externalId)]);
  },

  async loadKind(kind) {
    if (get().loadedKinds.has(kind)) return;
    set({ loading: true });
    try {
      const items = await listSavedItems(kind);
      set((state) => {
        const next = { ...state.byKey };
        for (const it of items) {
          next[key(it.kind, it.external_id)] = it;
        }
        const loaded = new Set(state.loadedKinds);
        loaded.add(kind);
        return { byKey: next, loadedKinds: loaded };
      });
    } finally {
      set({ loading: false });
    }
  },

  async save(kind, externalId, data) {
    // Optimistic: flip state immediately, roll back on failure.
    const k = key(kind, externalId);
    const prev = get().byKey[k];
    const placeholder: SavedItem = {
      id: `pending:${k}`,
      user_id: 'me',
      kind,
      external_id: externalId,
      data,
      created_at: new Date().toISOString(),
    };
    set((s) => ({ byKey: { ...s.byKey, [k]: placeholder } }));

    const result = await apiSaveItem(kind, externalId, data);
    if (!result) {
      set((s) => {
        const next = { ...s.byKey };
        if (prev) next[k] = prev;
        else delete next[k];
        return { byKey: next };
      });
      return false;
    }
    set((s) => ({ byKey: { ...s.byKey, [k]: result } }));
    return true;
  },

  async unsave(kind, externalId) {
    const k = key(kind, externalId);
    const prev = get().byKey[k];
    set((s) => {
      const next = { ...s.byKey };
      delete next[k];
      return { byKey: next };
    });
    const ok = await apiUnsaveItem(kind, externalId);
    if (!ok && prev) {
      // Only roll back if we had a real item before.
      set((s) => ({ byKey: { ...s.byKey, [k]: prev } }));
    }
    return ok;
  },

  _setForTests(next) {
    set(next as SavedState);
  },
}));
