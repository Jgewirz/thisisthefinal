import { create } from 'zustand';
import {
  createWardrobeItem as apiCreate,
  deleteWardrobeItem as apiDelete,
  listWardrobe as apiList,
  updateWardrobeItem as apiUpdate,
  type CreateWardrobePayload,
  type UpdateWardrobePayload,
  type WardrobeCategory,
  type WardrobeItem,
} from '../lib/wardrobeApi';

interface WardrobeState {
  byId: Record<string, WardrobeItem>;
  loaded: boolean;
  loading: boolean;
  /** Last error message from a network call, if any. UI can surface this. */
  error: string | null;

  list: () => WardrobeItem[];
  byCategory: (category: WardrobeCategory) => WardrobeItem[];

  load: (force?: boolean) => Promise<void>;
  add: (payload: CreateWardrobePayload, clientId?: string) => Promise<WardrobeItem | null>;
  patch: (id: string, p: UpdateWardrobePayload) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;

  _setForTests: (next: Partial<WardrobeState>) => void;
}

function sortByCreatedDesc(items: WardrobeItem[]): WardrobeItem[] {
  return [...items].sort((a, b) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
  );
}

export const useWardrobeStore = create<WardrobeState>((set, get) => ({
  byId: {},
  loaded: false,
  loading: false,
  error: null,

  list() {
    return sortByCreatedDesc(Object.values(get().byId));
  },
  byCategory(category) {
    return sortByCreatedDesc(
      Object.values(get().byId).filter((it) => it.category === category)
    );
  },

  async load(force = false) {
    if (get().loading) return;
    if (get().loaded && !force) return;
    set({ loading: true, error: null });
    try {
      const items = await apiList();
      const byId: Record<string, WardrobeItem> = {};
      for (const it of items) byId[it.id] = it;
      set({ byId, loaded: true });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load wardrobe' });
    } finally {
      set({ loading: false });
    }
  },

  async add(payload, clientId) {
    set({ error: null });
    // No optimistic placeholder on create — without a server id, rolling back
    // and de-duping against the eventual row is fiddly. Spinner is acceptable.
    const item = await apiCreate(payload, clientId);
    if (!item) {
      set({ error: 'Failed to add item' });
      return null;
    }
    set((s) => ({ byId: { ...s.byId, [item.id]: item } }));
    return item;
  },

  async patch(id, p) {
    const prev = get().byId[id];
    if (!prev) return false;
    const optimistic: WardrobeItem = {
      ...prev,
      ...(p.imageUrl !== undefined ? { image_url: p.imageUrl ?? null } : {}),
      ...(p.category !== undefined ? { category: p.category } : {}),
      ...(p.subtype !== undefined ? { subtype: p.subtype ?? null } : {}),
      ...(p.color !== undefined ? { color: p.color ?? null } : {}),
      ...(p.colorHex !== undefined ? { color_hex: p.colorHex ?? null } : {}),
      ...(p.pattern !== undefined ? { pattern: p.pattern ?? null } : {}),
      ...(p.seasons !== undefined ? { seasons: p.seasons } : {}),
      ...(p.occasions !== undefined ? { occasions: p.occasions } : {}),
      ...(p.warmth !== undefined ? { warmth: p.warmth ?? null } : {}),
      ...(p.attributes !== undefined ? { attributes: p.attributes } : {}),
    };
    set((s) => ({ byId: { ...s.byId, [id]: optimistic } }));

    const updated = await apiUpdate(id, p);
    if (!updated) {
      set((s) => ({ byId: { ...s.byId, [id]: prev }, error: 'Failed to update item' }));
      return false;
    }
    set((s) => ({ byId: { ...s.byId, [id]: updated } }));
    return true;
  },

  async remove(id) {
    const prev = get().byId[id];
    if (!prev) return false;
    set((s) => {
      const next = { ...s.byId };
      delete next[id];
      return { byId: next };
    });

    const ok = await apiDelete(id);
    if (!ok) {
      set((s) => ({ byId: { ...s.byId, [id]: prev }, error: 'Failed to delete item' }));
      return false;
    }
    return true;
  },

  _setForTests(next) {
    set(next as WardrobeState);
  },
}));
