import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Durable UI state for "Save to wardrobe" CTAs in chat.
 *
 * We use a stable client id (message id) as the key. This persists across page
 * refresh so users don't see the button reset back to "Save" after they've
 * already saved that photo to their wardrobe.
 *
 * Note: this is intentionally *not* the source of truth for wardrobe items —
 * it's just to remember that a given chat photo message was already saved.
 */

interface WardrobeSavesState {
  savedMessageIds: Record<string, true>;
  isSaved: (messageId: string) => boolean;
  markSaved: (messageId: string) => void;
  clear: () => void;
  _setForTests: (next: Partial<WardrobeSavesState>) => void;
}

export const useWardrobeSavesStore = create<WardrobeSavesState>()(
  persist(
    (set, get) => ({
      savedMessageIds: {},
      isSaved(messageId) {
        return Boolean(get().savedMessageIds[messageId]);
      },
      markSaved(messageId) {
        if (!messageId) return;
        set((s) => ({ savedMessageIds: { ...s.savedMessageIds, [messageId]: true } }));
      },
      clear() {
        set({ savedMessageIds: {} });
      },
      _setForTests(next) {
        set(next as WardrobeSavesState);
      },
    }),
    { name: 'girlbot-wardrobe-saves' }
  )
);

