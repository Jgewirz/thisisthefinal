import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Types ─────────────────────────────────────────────────────────────

export interface RecentLifestyleSearch {
  id: string;
  type: string;
  params: Record<string, any>;
  label: string;
  searchedAt: string;
}

export interface SavedRestaurant {
  id: string;
  name: string;
  address: string;
  cuisine?: string;
  rating?: number;
  savedAt: string;
}

export interface LifestyleProfile {
  preferredCuisines: string[];
  preferredPriceLevels: string[];
  coffeeDrinkPreferences: string[];
  favoriteRestaurants: SavedRestaurant[];
  favoriteCafes: SavedRestaurant[];
  frequentLocations: { city: string; count: number }[];
  activityPatterns: { pattern: string; confidence: number }[];
  recentSearches: RecentLifestyleSearch[];
  lastSearchResults: any[];
}

interface LifestyleStore {
  profile: LifestyleProfile;
  addRecentSearch: (search: Omit<RecentLifestyleSearch, 'id' | 'searchedAt'>) => void;
  setLastSearchResults: (results: any[]) => void;
  addFavoriteRestaurant: (restaurant: Omit<SavedRestaurant, 'id' | 'savedAt'>) => void;
  removeFavoriteRestaurant: (id: string) => void;
  addPreferredCuisine: (cuisine: string) => void;
  setPreferredPriceLevels: (levels: string[]) => void;
  hydrateFromApi: () => Promise<void>;
  resetProfile: () => void;
}

const defaultProfile: LifestyleProfile = {
  preferredCuisines: [],
  preferredPriceLevels: [],
  coffeeDrinkPreferences: [],
  favoriteRestaurants: [],
  favoriteCafes: [],
  frequentLocations: [],
  activityPatterns: [],
  recentSearches: [],
  lastSearchResults: [],
};

let hydrationPromise: Promise<void> | null = null;

export const useLifestyleStore = create<LifestyleStore>()(
  persist(
    (set, get) => ({
      profile: { ...defaultProfile },

      addRecentSearch: (search) =>
        set((state) => {
          const newSearch: RecentLifestyleSearch = {
            ...search,
            id: crypto.randomUUID(),
            searchedAt: new Date().toISOString(),
          };
          const searches = [newSearch, ...state.profile.recentSearches].slice(0, 10);
          return { profile: { ...state.profile, recentSearches: searches } };
        }),

      setLastSearchResults: (results) =>
        set((state) => ({
          profile: { ...state.profile, lastSearchResults: results },
        })),

      addFavoriteRestaurant: (restaurant) => {
        const newItem: SavedRestaurant = {
          ...restaurant,
          id: crypto.randomUUID(),
          savedAt: new Date().toISOString(),
        };
        set((state) => ({
          profile: {
            ...state.profile,
            favoriteRestaurants: [...state.profile.favoriteRestaurants, newItem],
          },
        }));
      },

      removeFavoriteRestaurant: (id) =>
        set((state) => ({
          profile: {
            ...state.profile,
            favoriteRestaurants: state.profile.favoriteRestaurants.filter((r) => r.id !== id),
          },
        })),

      addPreferredCuisine: (cuisine) =>
        set((state) => {
          if (state.profile.preferredCuisines.includes(cuisine)) return state;
          return {
            profile: {
              ...state.profile,
              preferredCuisines: [...state.profile.preferredCuisines, cuisine].slice(0, 10),
            },
          };
        }),

      setPreferredPriceLevels: (levels) =>
        set((state) => ({
          profile: { ...state.profile, preferredPriceLevels: levels },
        })),

      hydrateFromApi: async () => {
        if (hydrationPromise) return hydrationPromise;

        hydrationPromise = (async () => {
          try {
            const res = await fetch('/api/lifestyle/profile', {
              headers: { 'Content-Type': 'application/json' },
            });
            if (!res.ok) return;
            const { profile: apiProfile } = await res.json();

            set((state) => ({
              profile: {
                ...state.profile,
                // Merge API-learned preferences with local state
                preferredCuisines: apiProfile.preferredCuisines?.length
                  ? apiProfile.preferredCuisines
                  : state.profile.preferredCuisines,
                coffeeDrinkPreferences: apiProfile.coffeeDrinkPreferences?.length
                  ? apiProfile.coffeeDrinkPreferences
                  : state.profile.coffeeDrinkPreferences,
                frequentLocations: apiProfile.frequentLocations?.length
                  ? apiProfile.frequentLocations
                  : state.profile.frequentLocations,
                activityPatterns: apiProfile.activityPatterns?.length
                  ? apiProfile.activityPatterns
                  : state.profile.activityPatterns,
              },
            }));
          } catch {
            // API unavailable — localStorage data is still valid
          } finally {
            hydrationPromise = null;
          }
        })();

        return hydrationPromise;
      },

      resetProfile: () => set({ profile: { ...defaultProfile } }),
    }),
    {
      name: 'girlbot-lifestyle-profile',
      partialize: (state: any) => ({
        profile: {
          ...state.profile,
          lastSearchResults: [],
        },
      }),
      merge: (persisted: any, current: any) => {
        const persistedProfile = persisted?.profile || {};
        return {
          ...current,
          profile: {
            ...defaultProfile,
            ...persistedProfile,
            recentSearches: persistedProfile.recentSearches || [],
            favoriteRestaurants: persistedProfile.favoriteRestaurants || [],
            favoriteCafes: persistedProfile.favoriteCafes || [],
            preferredCuisines: persistedProfile.preferredCuisines || [],
            lastSearchResults: [],
          },
        };
      },
    }
  )
);
