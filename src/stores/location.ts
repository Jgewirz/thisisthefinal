import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useTravelStore } from './travel';
import { useFitnessStore } from './fitness';

export interface UserLocation {
  lat: number;
  lng: number;
  city: string | null;
  region: string | null;
  country: string | null;
  timezone: string;
  nearestAirport: string | null;
  updatedAt: string;
}

interface LocationStore {
  location: UserLocation | null;
  isRequesting: boolean;
  error: string | null;
  requestLocation: () => Promise<void>;
  hydrateFromDb: () => Promise<void>;
}

function apiHeaders() {
  return {
    'Content-Type': 'application/json',
  };
}

let locationHydrationPromise: Promise<void> | null = null;

export const useLocationStore = create<LocationStore>()(
  persist(
    (set, get) => ({
      location: null,
      isRequesting: false,
      error: null,

      requestLocation: async () => {
        if (get().isRequesting) return;
        set({ isRequesting: true, error: null });

        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 10000,
              maximumAge: 300000, // 5 min cache
            });
          });

          const { latitude: lat, longitude: lng } = position.coords;
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

          // Reverse-geocode via our server (which uses Google Geocoding API)
          let city: string | null = null;
          let region: string | null = null;
          let country: string | null = null;
          let nearestAirport: string | null = null;

          try {
            const res = await fetch('/api/location/reverse-geocode', {
              method: 'POST',
              headers: apiHeaders(),
              body: JSON.stringify({ lat, lng }),
            });
            if (res.ok) {
              const data = await res.json();
              city = data.city;
              region = data.region;
              country = data.country;
              nearestAirport = data.nearestAirport;
            }
          } catch {
            // Reverse geocode failed — continue with coords only
          }

          const now = new Date().toISOString();
          const location: UserLocation = {
            lat, lng, city, region, country, timezone, nearestAirport, updatedAt: now,
          };

          set({ location, isRequesting: false, error: null });

          // Auto-populate other agent stores
          if (nearestAirport) {
            useTravelStore.getState().setHomeAirport(nearestAirport);
          }
          useFitnessStore.getState().setHomeLocation({
            lat, lng, label: city && region ? `${city}, ${region}` : `${lat.toFixed(2)}, ${lng.toFixed(2)}`,
          });

          // Persist to DB (fire-and-forget)
          fetch('/api/location', {
            method: 'POST',
            headers: apiHeaders(),
            body: JSON.stringify({ lat, lng, city, region, country, timezone, nearestAirport }),
          }).catch(() => {});
        } catch (err: any) {
          let error = 'Unable to get your location.';
          if (err?.code === 1) {
            error = 'Location permission denied. Please enable location access in your browser settings.';
          } else if (err?.code === 2) {
            error = 'Location unavailable. Please try again.';
          } else if (err?.code === 3) {
            error = 'Location request timed out. Please try again.';
          }
          set({ isRequesting: false, error });
        }
      },

      hydrateFromDb: async () => {
        if (locationHydrationPromise) return locationHydrationPromise;

        locationHydrationPromise = (async () => {
          try {
            const res = await fetch('/api/location', {
              headers: apiHeaders(),
            });
            if (!res.ok) return;
            const { location: dbLocation } = await res.json();
            if (!dbLocation) return;

            const current = get().location;
            // DB wins if newer or local is missing
            if (!current || (dbLocation.updatedAt && (!current.updatedAt || dbLocation.updatedAt > current.updatedAt))) {
              set({ location: dbLocation });

              // Also sync to other stores
              if (dbLocation.nearestAirport) {
                useTravelStore.getState().setHomeAirport(dbLocation.nearestAirport);
              }
              if (dbLocation.lat != null && dbLocation.lng != null) {
                useFitnessStore.getState().setHomeLocation({
                  lat: dbLocation.lat,
                  lng: dbLocation.lng,
                  label: dbLocation.city && dbLocation.region
                    ? `${dbLocation.city}, ${dbLocation.region}`
                    : `${dbLocation.lat.toFixed(2)}, ${dbLocation.lng.toFixed(2)}`,
                });
              }
            }
          } catch {
            // Silent — DB hydration is best-effort
          } finally {
            locationHydrationPromise = null;
          }
        })();

        return locationHydrationPromise;
      },
    }),
    {
      name: 'girlbot-location',
      partialize: (state) => ({ location: state.location }),
    }
  )
);
