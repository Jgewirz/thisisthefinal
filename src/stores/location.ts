import { create } from 'zustand';

export type LocationStatus =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'error';

interface LocationStore {
  coords: { lat: number; lng: number } | null;
  status: LocationStatus;
  error: string | null;
  request: () => Promise<void>;
  clear: () => void;
}

export const useLocationStore = create<LocationStore>((set) => ({
  coords: null,
  status: 'idle',
  error: null,

  request: async () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      set({ status: 'unavailable', error: 'Geolocation not supported by this browser' });
      return;
    }

    set({ status: 'requesting', error: null });

    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          set({
            coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            status: 'granted',
            error: null,
          });
          resolve();
        },
        (err) => {
          const denied = err.code === err.PERMISSION_DENIED;
          set({
            status: denied ? 'denied' : 'error',
            error: err.message || 'Unable to retrieve location',
          });
          resolve();
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 }
      );
    });
  },

  clear: () => set({ coords: null, status: 'idle', error: null }),
}));
