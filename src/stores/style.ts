import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StyleProfile {
  bodyType: string | null;
  skinTone: {
    depth: string;
    undertone: string;
    season: string;
    bestColors: string[];
    bestMetals: string;
  } | null;
  styleEssences: string[];
  budgetRange: string | null;
  wardrobeItems: WardrobeItem[];
  occasions: string[];
  onboardingComplete: boolean;
  onboardingStep: number; // 0-6
}

export interface WardrobeItem {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  category: string;
  color: string;
  colorHex: string;
  style: string;
  seasons: string[];
  occasions: string[];
  pairsWith: string[];
  addedAt: string;
}

interface StyleStore {
  profile: StyleProfile;
  wardrobeLoaded: boolean;
  wardrobeSyncing: boolean;
  updateProfile: (updates: Partial<StyleProfile>) => void;
  setSkinTone: (skinTone: StyleProfile['skinTone']) => void;
  addWardrobeItem: (item: WardrobeItem) => void;
  uploadAndAddItem: (base64: string, metadata: Omit<WardrobeItem, 'id' | 'imageUrl' | 'thumbnailUrl' | 'addedAt'>) => Promise<WardrobeItem | null>;
  loadWardrobe: () => Promise<void>;
  removeWardrobeItem: (id: string) => Promise<void>;
  advanceOnboarding: () => void;
  completeOnboarding: () => void;
  resetProfile: () => void;
  syncToServer: () => Promise<void>;
  importWardrobeSnapshot: (items: WardrobeItem[]) => Promise<WardrobeItem[]>;
}

const defaultProfile: StyleProfile = {
  bodyType: null,
  skinTone: null,
  styleEssences: [],
  budgetRange: null,
  wardrobeItems: [],
  occasions: [],
  onboardingComplete: false,
  onboardingStep: 0,
};

export const useStyleStore = create<StyleStore>()(
  persist(
    (set, get) => ({
      profile: { ...defaultProfile },
      wardrobeLoaded: false,
      wardrobeSyncing: false,

      updateProfile: (updates) =>
        set((state) => ({
          profile: { ...state.profile, ...updates },
        })),

      setSkinTone: (skinTone) =>
        set((state) => ({
          profile: { ...state.profile, skinTone },
        })),

      addWardrobeItem: (item) =>
        set((state) => ({
          profile: {
            ...state.profile,
            wardrobeItems: [...state.profile.wardrobeItems, item],
          },
        })),

      uploadAndAddItem: async (base64, metadata) => {
        set({ wardrobeSyncing: true });
        try {
          const res = await fetch('/api/style/wardrobe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              image: base64,
              ...metadata,
            }),
          });

          if (!res.ok) return null;
          const { item } = await res.json();

          set((state) => ({
            profile: {
              ...state.profile,
              wardrobeItems: [...state.profile.wardrobeItems, item],
            },
          }));

          return item;
        } catch {
          return null;
        } finally {
          set({ wardrobeSyncing: false });
        }
      },

      loadWardrobe: async () => {
        try {
          const res = await fetch('/api/style/wardrobe', { credentials: 'include' });
          if (!res.ok) return;
          const { items } = await res.json();

          const localWardrobe = get().profile.wardrobeItems.filter((item) => !item.imageUrl.startsWith('data:'));
          let nextItems = items;

          if (items.length === 0 && localWardrobe.length > 0) {
            nextItems = await get().importWardrobeSnapshot(localWardrobe);
          }

          set((state) => ({
            profile: { ...state.profile, wardrobeItems: nextItems },
            wardrobeLoaded: true,
          }));
        } catch {
          // Silent fail — localStorage items remain
        }
      },

      importWardrobeSnapshot: async (items) => {
        if (items.length === 0) return [];

        try {
          const res = await fetch('/api/style/wardrobe/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ items }),
          });

          if (!res.ok) {
            return items;
          }

          const { items: imported } = await res.json();
          return imported;
        } catch {
          return items;
        }
      },

      removeWardrobeItem: async (id: string) => {
        try {
          await fetch(`/api/style/wardrobe/${id}`, {
            method: 'DELETE',
            credentials: 'include',
          });
        } catch {
          // Continue with local removal even if server fails
        }

        set((state) => ({
          profile: {
            ...state.profile,
            wardrobeItems: state.profile.wardrobeItems.filter((i) => i.id !== id),
          },
        }));
      },

      advanceOnboarding: () =>
        set((state) => ({
          profile: {
            ...state.profile,
            onboardingStep: Math.min(state.profile.onboardingStep + 1, 6),
          },
        })),

      completeOnboarding: () =>
        set((state) => ({
          profile: {
            ...state.profile,
            onboardingComplete: true,
            onboardingStep: 6,
          },
        })),

      resetProfile: () => set({ profile: { ...defaultProfile }, wardrobeLoaded: false }),

      syncToServer: async () => {
        const { profile } = get();
        try {
          await fetch('/api/style/profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ profile }),
          });
        } catch {
          // Silent fail — localStorage is the primary store
        }
      },
    }),
    {
      name: 'girlbot-style-profile',
      partialize: (state) => ({
        profile: {
          ...state.profile,
          // Filter out any stale base64 items (safety net during migration)
          wardrobeItems: state.profile.wardrobeItems.filter(
            (item) => !item.imageUrl.startsWith('data:')
          ),
        },
      }),
    }
  )
);
