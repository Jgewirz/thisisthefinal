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
  updateProfile: (updates: Partial<StyleProfile>) => void;
  setSkinTone: (skinTone: StyleProfile['skinTone']) => void;
  addWardrobeItem: (item: WardrobeItem) => void;
  advanceOnboarding: () => void;
  completeOnboarding: () => void;
  resetProfile: () => void;
  syncToServer: () => Promise<void>;
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

      resetProfile: () => set({ profile: { ...defaultProfile } }),

      syncToServer: async () => {
        const { profile } = get();
        try {
          await fetch('/api/style/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile }),
          });
        } catch {
          // Silent fail — localStorage is the primary store
        }
      },
    }),
    {
      name: 'girlbot-style-profile',
    }
  )
);
