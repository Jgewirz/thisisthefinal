import { create } from 'zustand';
import { UNKNOWN_STATUS, type ProviderStatus } from '../app/agentStatus';
import { fetchProviderStatus } from '../lib/statusApi';

interface StatusState {
  status: ProviderStatus;
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  /** Test/dev hook so specs can inject a known snapshot. */
  setStatus: (s: ProviderStatus) => void;
}

export const useStatusStore = create<StatusState>((set, get) => ({
  status: UNKNOWN_STATUS,
  loaded: false,
  loading: false,
  async load() {
    if (get().loading) return;
    set({ loading: true });
    const next = await fetchProviderStatus();
    set({ status: next, loaded: true, loading: false });
  },
  setStatus(s) {
    set({ status: s, loaded: true, loading: false });
  },
}));
