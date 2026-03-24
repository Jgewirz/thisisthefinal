import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── API helpers ───────────────────────────────────────────────────────

function apiHeaders() {
  return {
    'Content-Type': 'application/json',
  };
}

async function apiPost(path: string, body: object) {
  try {
    const res = await fetch(`/api/fitness${path}`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`Fitness API POST ${path} failed:`, res.status, err);
    }
  } catch (e) {
    console.warn(`Fitness API POST ${path} network error:`, e);
  }
}

async function apiDelete(path: string) {
  try {
    await fetch(`/api/fitness${path}`, {
      method: 'DELETE',
      headers: apiHeaders(),
    });
  } catch {
    // Silent
  }
}

// ── Types ─────────────────────────────────────────────────────────────

export interface ScheduleItem {
  id: string;
  type: 'class';
  data: Record<string, any>;
  label: string;
  selectedAt: string;
}

export interface FitnessBookmark {
  id: string;
  type: 'class';
  data: Record<string, any>;
  label: string;
  createdAt: string;
}

export interface RecentFitnessSearch {
  id: string;
  type: 'class_search';
  params: Record<string, any>;
  label: string;
  searchedAt: string;
}

export interface FitnessBooking {
  id: string;
  className: string;
  instructor?: string;
  studioName: string;
  studioAddress?: string;
  date: string;
  time: string;
  duration?: string;
  category?: string;
  bookingPlatform: 'mindbody' | 'website' | 'manual' | 'browser';
  bookingStatus: 'confirmed' | 'cancelled' | 'pending';
  bookingUrl?: string;
  studioWebsite?: string;
  studioGoogleMapsUrl?: string;
  bookedAt: string;
}

export interface FitnessProfile {
  homeLocation: { lat: number; lng: number; label: string } | null;
  preferredClassTypes: string[];
  preferredTimes: string[];
  fitnessLevel: string | null;
  recentSearches: RecentFitnessSearch[];
  bookmarks: FitnessBookmark[];
  schedule: ScheduleItem[];
  bookings: FitnessBooking[];
  lastSearchResults: any[];
}

interface FitnessStore {
  profile: FitnessProfile;
  setHomeLocation: (location: FitnessProfile['homeLocation']) => void;
  setFitnessLevel: (level: string | null) => void;
  addPreferredClassType: (type: string) => void;
  addPreferredTime: (time: string) => void;
  addRecentSearch: (search: Omit<RecentFitnessSearch, 'id' | 'searchedAt'>) => void;
  addBookmark: (bookmark: Omit<FitnessBookmark, 'id' | 'createdAt'>) => void;
  removeBookmark: (id: string) => void;
  addToSchedule: (item: Omit<ScheduleItem, 'id' | 'selectedAt'>) => void;
  removeFromSchedule: (id: string) => void;
  isScheduled: (label: string) => boolean;
  setLastSearchResults: (results: any[]) => void;
  bookClass: (classData: any, bookingPlatform: 'mindbody' | 'website' | 'manual' | 'browser') => Promise<FitnessBooking | null>;
  cancelBooking: (id: string) => Promise<boolean>;
  hydrateFromDb: () => Promise<void>;
  resetProfile: () => void;
}

const defaultProfile: FitnessProfile = {
  homeLocation: null,
  preferredClassTypes: [],
  preferredTimes: [],
  fitnessLevel: null,
  recentSearches: [],
  bookmarks: [],
  schedule: [],
  bookings: [],
  lastSearchResults: [],
};

let fitnessHydrationPromise: Promise<void> | null = null;

export const useFitnessStore = create<FitnessStore>()(
  persist(
    (set, get) => ({
      profile: { ...defaultProfile },

      setHomeLocation: (location) =>
        set((state) => ({
          profile: { ...state.profile, homeLocation: location },
        })),

      setFitnessLevel: (level) =>
        set((state) => ({
          profile: { ...state.profile, fitnessLevel: level },
        })),

      addPreferredClassType: (type) =>
        set((state) => {
          if (state.profile.preferredClassTypes.includes(type)) return state;
          return {
            profile: {
              ...state.profile,
              preferredClassTypes: [...state.profile.preferredClassTypes, type].slice(0, 10),
            },
          };
        }),

      addPreferredTime: (time) =>
        set((state) => {
          if (state.profile.preferredTimes.includes(time)) return state;
          return {
            profile: {
              ...state.profile,
              preferredTimes: [...state.profile.preferredTimes, time],
            },
          };
        }),

      addRecentSearch: (search) =>
        set((state) => {
          const newSearch: RecentFitnessSearch = {
            ...search,
            id: crypto.randomUUID(),
            searchedAt: new Date().toISOString(),
          };
          const searches = [newSearch, ...state.profile.recentSearches].slice(0, 10);
          return { profile: { ...state.profile, recentSearches: searches } };
        }),

      addBookmark: (bookmark) => {
        const newBookmark: FitnessBookmark = {
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

          // Auto-learn: track preferred class types from bookmarks
          let preferredClassTypes = [...state.profile.preferredClassTypes];
          const category = bookmark.data.category as string | undefined;
          if (category && !preferredClassTypes.includes(category.toLowerCase())) {
            preferredClassTypes = [...preferredClassTypes, category.toLowerCase()].slice(0, 10);
          }

          return {
            profile: {
              ...state.profile,
              bookmarks: newBookmarks,
              preferredClassTypes,
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

      addToSchedule: (item) => {
        const state = get();
        if (state.profile.schedule.some((s) => s.label === item.label)) return;

        const newItem: ScheduleItem = {
          ...item,
          id: crypto.randomUUID(),
          selectedAt: new Date().toISOString(),
        };

        // Persist to DB
        apiPost('/schedule', {
          type: item.type,
          data: item.data,
          label: item.label,
        });

        // Auto-learn time preference from scheduled classes
        const timeOfDay = item.data.time as string | undefined;
        if (timeOfDay) {
          const hour = new Date(item.data.startDateTime || '').getHours();
          let period = '';
          if (hour >= 5 && hour < 12) period = 'morning';
          else if (hour >= 12 && hour < 17) period = 'afternoon';
          else if (hour >= 17) period = 'evening';
          if (period) get().addPreferredTime(period);
        }

        set((s) => ({
          profile: {
            ...s.profile,
            schedule: [...s.profile.schedule, newItem],
          },
        }));
      },

      removeFromSchedule: (id) => {
        apiDelete(`/schedule/${id}`);
        set((state) => ({
          profile: {
            ...state.profile,
            schedule: state.profile.schedule.filter((s) => s.id !== id),
          },
        }));
      },

      isScheduled: (label) => {
        return get().profile.schedule.some((s) => s.label === label);
      },

      setLastSearchResults: (results) =>
        set((state) => ({
          profile: { ...state.profile, lastSearchResults: results },
        })),

      bookClass: async (classData, bookingPlatform) => {
        try {
          const res = await fetch('/api/fitness/book', {
            method: 'POST',
            headers: apiHeaders(),
            body: JSON.stringify({ classData, bookingPlatform }),
          });

          if (!res.ok) {
            console.warn('Fitness book failed:', res.status);
            return null;
          }

          const result = await res.json();
          const booking: FitnessBooking = {
            id: result.id,
            className: result.className || classData.className,
            instructor: classData.instructor,
            studioName: result.studioName || classData.studioName,
            studioAddress: classData.studioAddress,
            date: result.date || classData.date,
            time: result.time || classData.time,
            duration: classData.duration,
            category: classData.category,
            bookingPlatform: result.bookingPlatform || bookingPlatform,
            bookingStatus: result.status || 'confirmed',
            bookingUrl: result.bookingUrl,
            studioWebsite: classData.studioWebsite,
            studioGoogleMapsUrl: classData.studioGoogleMapsUrl,
            bookedAt: new Date().toISOString(),
          };

          set((state) => ({
            profile: {
              ...state.profile,
              bookings: [...state.profile.bookings, booking],
            },
          }));

          // Also add to schedule
          const label = `${booking.className} — ${booking.time} (${booking.studioName})`;
          get().addToSchedule({
            type: 'class',
            data: classData,
            label,
          });

          return booking;
        } catch (err) {
          console.warn('Fitness book error:', err);
          return null;
        }
      },

      cancelBooking: async (id) => {
        try {
          const res = await fetch(`/api/fitness/book/${id}`, {
            method: 'DELETE',
            headers: apiHeaders(),
          });

          if (!res.ok) return false;

          set((state) => ({
            profile: {
              ...state.profile,
              bookings: state.profile.bookings.filter((b) => b.id !== id),
            },
          }));

          return true;
        } catch {
          return false;
        }
      },

      hydrateFromDb: async () => {
        if (fitnessHydrationPromise) return fitnessHydrationPromise;

        fitnessHydrationPromise = (async () => {
          try {
            const headers = apiHeaders();
            const [bookmarksRes, scheduleRes, bookingsRes] = await Promise.all([
              fetch('/api/fitness/bookmarks', { headers }),
              fetch('/api/fitness/schedule', { headers }),
              fetch('/api/fitness/bookings', { headers }),
            ]);

            const dbBookmarks = bookmarksRes.ok ? (await bookmarksRes.json()).bookmarks || [] : [];
            const dbSchedule = scheduleRes.ok ? (await scheduleRes.json()).schedule || [] : [];
            const dbBookings = bookingsRes.ok ? (await bookingsRes.json()).bookings || [] : [];

            set((state) => {
              const localBookmarkLabels = new Set(state.profile.bookmarks.map((b) => b.label));
              const mergedBookmarks = [
                ...state.profile.bookmarks,
                ...dbBookmarks.filter((b: any) => !localBookmarkLabels.has(b.label)),
              ];

              const localScheduleLabels = new Set(state.profile.schedule.map((s) => s.label));
              const mergedSchedule = [
                ...state.profile.schedule,
                ...dbSchedule.filter((s: any) => !localScheduleLabels.has(s.label)),
              ];

              return {
                profile: {
                  ...state.profile,
                  bookmarks: mergedBookmarks,
                  schedule: mergedSchedule,
                  bookings: dbBookings,
                },
              };
            });
          } catch {
            // DB unavailable — localStorage data is still valid
          } finally {
            fitnessHydrationPromise = null;
          }
        })();

        return fitnessHydrationPromise;
      },

      resetProfile: () => set({ profile: { ...defaultProfile } }),
    }),
    {
      name: 'girlbot-fitness-profile',
      partialize: (state: any) => ({
        profile: {
          ...state.profile,
          // Exclude ephemeral data from persistence — only needed within a session
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
            bookmarks: persistedProfile.bookmarks || [],
            schedule: persistedProfile.schedule || [],
            bookings: persistedProfile.bookings || [],
            lastSearchResults: [],
            preferredClassTypes: persistedProfile.preferredClassTypes || [],
            preferredTimes: persistedProfile.preferredTimes || [],
          },
        };
      },
    }
  )
);
