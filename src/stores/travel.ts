import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── API helpers (fire-and-forget for writes, awaited for reads) ────────

function apiHeaders() {
  return {
    'Content-Type': 'application/json',
  };
}

async function apiPost(path: string, body: object) {
  try {
    const res = await fetch(`/api/travel${path}`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`Travel API POST ${path} failed:`, res.status, err);
    }
  } catch (e) {
    console.warn(`Travel API POST ${path} network error:`, e);
  }
}

async function apiDelete(path: string) {
  try {
    await fetch(`/api/travel${path}`, {
      method: 'DELETE',
      headers: apiHeaders(),
    });
  } catch {
    // Silent
  }
}

// ── Types ──────────────────────────────────────────────────────────────

export interface TripSelection {
  id: string;
  type: 'flight' | 'hotel';
  data: Record<string, any>;
  label: string;
  selectedAt: string;
}

export interface LastSearchIntent {
  type: string;
  params: Record<string, any>;
  timestamp: string;
}

export interface TravelProfile {
  homeAirport: string | null;
  preferredCabin: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  preferredCurrency: string;
  recentSearches: RecentSearch[];
  bookmarks: TravelBookmark[];
  tripSelections: TripSelection[];
  maxPricePreference: number | null;
  preferredAirlines: string[];
  excludedAirlines: string[];
  lastSearchIntent: LastSearchIntent | null;
}

export interface RecentSearch {
  id: string;
  type: 'flight_search' | 'hotel_search' | 'poi_search' | 'cheapest_dates';
  params: Record<string, any>;
  label: string;
  searchedAt: string;
}

export interface TravelBookmark {
  id: string;
  type: 'flight' | 'hotel' | 'poi';
  data: Record<string, any>;
  label: string;
  createdAt: string;
}

export interface ActiveBooking {
  jobId: string;
  flightData: Record<string, any>;
  passengerInfo: Record<string, any>;
  status: string;
}

interface TravelStore {
  profile: TravelProfile;
  activeBooking: ActiveBooking | null;
  startBooking: (flightData: Record<string, any>, passengerInfo: Record<string, any>) => Promise<string>;
  updateBookingStatus: (status: string) => void;
  clearActiveBooking: () => void;
  setHomeAirport: (airport: string | null) => void;
  setPreferredCabin: (cabin: TravelProfile['preferredCabin']) => void;
  setPreferredCurrency: (currency: string) => void;
  addRecentSearch: (search: Omit<RecentSearch, 'id' | 'searchedAt'>) => void;
  addBookmark: (bookmark: Omit<TravelBookmark, 'id' | 'createdAt'>) => void;
  removeBookmark: (id: string) => void;
  addTripSelection: (selection: Omit<TripSelection, 'id' | 'selectedAt'>) => void;
  removeTripSelection: (id: string) => void;
  clearTripSelections: () => void;
  isTripSelected: (label: string) => boolean;
  setMaxPricePreference: (price: number | null) => void;
  addPreferredAirline: (code: string) => void;
  removePreferredAirline: (code: string) => void;
  addExcludedAirline: (code: string) => void;
  removeExcludedAirline: (code: string) => void;
  setLastSearchIntent: (intent: { type: string; params: Record<string, any> } | null) => void;
  hydrateFromDb: () => Promise<void>;
  resetProfile: () => void;
}

const defaultProfile: TravelProfile = {
  homeAirport: null,
  preferredCabin: 'ECONOMY',
  preferredCurrency: 'USD',
  recentSearches: [],
  bookmarks: [],
  tripSelections: [],
  maxPricePreference: null,
  preferredAirlines: [],
  excludedAirlines: [],
  lastSearchIntent: null,
};

let travelHydrationPromise: Promise<void> | null = null;

export const useTravelStore = create<TravelStore>()(
  persist(
    (set, get) => ({
      profile: { ...defaultProfile },
      activeBooking: null,

      startBooking: async (flightData, passengerInfo) => {
        const res = await fetch('/api/travel/book', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ flightData, passengerInfo }),
        });
        if (!res.ok) throw new Error('Failed to start booking');
        const data = await res.json();
        set({
          activeBooking: {
            jobId: data.jobId,
            flightData,
            passengerInfo,
            status: data.status,
          },
        });
        return data.jobId;
      },

      updateBookingStatus: (status) =>
        set((state) => ({
          activeBooking: state.activeBooking
            ? { ...state.activeBooking, status }
            : null,
        })),

      clearActiveBooking: () => set({ activeBooking: null }),

      setHomeAirport: (airport) =>
        set((state) => ({
          profile: { ...state.profile, homeAirport: airport },
        })),

      setPreferredCabin: (cabin) =>
        set((state) => ({
          profile: { ...state.profile, preferredCabin: cabin },
        })),

      setPreferredCurrency: (currency) =>
        set((state) => ({
          profile: { ...state.profile, preferredCurrency: currency },
        })),

      addRecentSearch: (search) =>
        set((state) => {
          const newSearch: RecentSearch = {
            ...search,
            id: crypto.randomUUID(),
            searchedAt: new Date().toISOString(),
          };
          const searches = [newSearch, ...state.profile.recentSearches].slice(0, 10);
          return { profile: { ...state.profile, recentSearches: searches } };
        }),

      addBookmark: (bookmark) => {
        const newBookmark: TravelBookmark = {
          ...bookmark,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };

        // Persist to DB
        apiPost('/bookmarks', {
          type: bookmark.type,
          data: bookmark.data,
          label: bookmark.label,
        });

        set((state) => {
          const newBookmarks = [...state.profile.bookmarks, newBookmark];

          // Auto-learn: if same airline appears in 2+ bookmarked flights, add to preferredAirlines
          let preferredAirlines = [...state.profile.preferredAirlines];
          if (bookmark.type === 'flight' && bookmark.data.validatingAirlineCode) {
            const code = bookmark.data.validatingAirlineCode as string;
            const flightBookmarks = newBookmarks.filter((b) => b.type === 'flight');
            const airlineCounts = new Map<string, number>();
            for (const fb of flightBookmarks) {
              const ac = fb.data.validatingAirlineCode as string;
              if (ac) airlineCounts.set(ac, (airlineCounts.get(ac) || 0) + 1);
            }
            if ((airlineCounts.get(code) || 0) >= 2 && !preferredAirlines.includes(code)) {
              preferredAirlines = [...preferredAirlines, code];
            }
          }

          return {
            profile: {
              ...state.profile,
              bookmarks: newBookmarks,
              preferredAirlines,
            },
          };
        });
      },

      removeBookmark: (id) => {
        apiDelete(`/bookmarks/${id}`);
        set((state) => ({
          profile: {
            ...state.profile,
            bookmarks: state.profile.bookmarks.filter((b) => b.id !== id),
          },
        }));
      },

      addTripSelection: (selection) => {
        const state = get();
        if (state.profile.tripSelections.some((s) => s.label === selection.label)) return;

        const newSelection: TripSelection = {
          ...selection,
          id: crypto.randomUUID(),
          selectedAt: new Date().toISOString(),
        };

        // Persist to DB
        apiPost('/trip-selections', {
          type: selection.type,
          data: selection.data,
          label: selection.label,
        });

        set((s) => ({
          profile: {
            ...s.profile,
            tripSelections: [...s.profile.tripSelections, newSelection],
          },
        }));
      },

      removeTripSelection: (id) => {
        apiDelete(`/trip-selections/${id}`);
        set((state) => ({
          profile: {
            ...state.profile,
            tripSelections: state.profile.tripSelections.filter((s) => s.id !== id),
          },
        }));
      },

      clearTripSelections: () => {
        apiDelete('/trip-selections');
        set((state) => ({
          profile: { ...state.profile, tripSelections: [] },
        }));
      },

      isTripSelected: (label) => {
        return get().profile.tripSelections.some((s) => s.label === label);
      },

      setMaxPricePreference: (price) =>
        set((state) => ({
          profile: { ...state.profile, maxPricePreference: price },
        })),

      addPreferredAirline: (code) =>
        set((state) => {
          if (state.profile.preferredAirlines.includes(code)) return state;
          return {
            profile: {
              ...state.profile,
              preferredAirlines: [...state.profile.preferredAirlines, code],
            },
          };
        }),

      removePreferredAirline: (code) =>
        set((state) => ({
          profile: {
            ...state.profile,
            preferredAirlines: state.profile.preferredAirlines.filter((c) => c !== code),
          },
        })),

      addExcludedAirline: (code) =>
        set((state) => {
          if (state.profile.excludedAirlines.includes(code)) return state;
          return {
            profile: {
              ...state.profile,
              excludedAirlines: [...state.profile.excludedAirlines, code],
            },
          };
        }),

      removeExcludedAirline: (code) =>
        set((state) => ({
          profile: {
            ...state.profile,
            excludedAirlines: state.profile.excludedAirlines.filter((c) => c !== code),
          },
        })),

      setLastSearchIntent: (intent: { type: string; params: Record<string, any> } | null) =>
        set((state: { profile: TravelProfile }) => ({
          profile: {
            ...state.profile,
            lastSearchIntent: intent
              ? { type: intent.type, params: intent.params, timestamp: new Date().toISOString() }
              : null,
          },
        })),

      hydrateFromDb: async () => {
        if (travelHydrationPromise) return travelHydrationPromise;

        travelHydrationPromise = (async () => {
          try {
            const headers = apiHeaders();
            const [bookmarksRes, selectionsRes] = await Promise.all([
              fetch('/api/travel/bookmarks', { headers }),
              fetch('/api/travel/trip-selections', { headers }),
            ]);

            const dbBookmarks = bookmarksRes.ok ? (await bookmarksRes.json()).bookmarks || [] : [];
            const dbSelections = selectionsRes.ok ? (await selectionsRes.json()).selections || [] : [];

            set((state) => {
              // Merge DB data with localStorage — DB wins for bookmarks/selections
              // since they're the durable store
              const localBookmarkIds = new Set(state.profile.bookmarks.map((b) => b.label));
              const mergedBookmarks = [
                ...state.profile.bookmarks,
                ...dbBookmarks.filter((b: any) => !localBookmarkIds.has(b.label)),
              ];

              const localSelectionIds = new Set(state.profile.tripSelections.map((s) => s.label));
              const mergedSelections = [
                ...state.profile.tripSelections,
                ...dbSelections.filter((s: any) => !localSelectionIds.has(s.label)),
              ];

              return {
                profile: {
                  ...state.profile,
                  bookmarks: mergedBookmarks,
                  tripSelections: mergedSelections,
                },
              };
            });
          } catch {
            // DB unavailable — localStorage data is still valid
          } finally {
            travelHydrationPromise = null;
          }
        })();

        return travelHydrationPromise;
      },

      resetProfile: () => set({ profile: { ...defaultProfile } }),
    }),
    {
      name: 'girlbot-travel-profile',
      merge: (persisted: any, current: any) => {
        const persistedProfile = persisted?.profile || {};
        return {
          ...current,
          profile: {
            ...defaultProfile,
            ...persistedProfile,
            // Ensure arrays are never undefined (covers old localStorage schemas)
            recentSearches: persistedProfile.recentSearches || [],
            bookmarks: persistedProfile.bookmarks || [],
            tripSelections: persistedProfile.tripSelections || [],
            preferredAirlines: persistedProfile.preferredAirlines || [],
            excludedAirlines: persistedProfile.excludedAirlines || [],
            lastSearchIntent: persistedProfile.lastSearchIntent || null,
          },
        };
      },
    }
  )
);
