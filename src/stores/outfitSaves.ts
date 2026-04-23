import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Durable UI state for user-saved outfit combinations from the Outfit Builder.
 *
 * Keyed by Outfit.id (pipe-joined wardrobe item ids), so a saved outfit stays
 * bookmarked across sessions. Note: this is *not* a server-side record — it
 * tracks which generated outfits the user has locally bookmarked.
 */

interface OutfitSavesState {
  savedIds: Record<string, true>;
  isSaved: (outfitId: string) => boolean;
  toggle: (outfitId: string) => void;
  clear: () => void;
  _setForTests: (next: Partial<OutfitSavesState>) => void;
}

export const useOutfitSavesStore = create<OutfitSavesState>()(
  persist(
    (set, get) => ({
      savedIds: {},

      isSaved(outfitId) {
        return Boolean(get().savedIds[outfitId]);
      },

      toggle(outfitId) {
        if (!outfitId) return;
        set((s) => {
          const next = { ...s.savedIds };
          if (next[outfitId]) {
            delete next[outfitId];
          } else {
            next[outfitId] = true;
          }
          return { savedIds: next };
        });
      },

      clear() {
        set({ savedIds: {} });
      },

      _setForTests(next) {
        set(next as OutfitSavesState);
      },
    }),
    { name: 'girlbot-outfit-saves' }
  )
);
