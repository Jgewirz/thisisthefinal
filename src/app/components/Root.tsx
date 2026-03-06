import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { useStyleStore } from '../../stores/style';
import { useTravelStore } from '../../stores/travel';
import { useFitnessStore } from '../../stores/fitness';
import { useLocationStore } from '../../stores/location';
import { useCalendarStore } from '../../stores/calendar';
import { useChatStore } from '../../stores/chat';
import { migrateBase64Wardrobe } from '../../lib/migration';
import { ensureSession } from '../../lib/session';

export function Root() {
  const [bootState, setBootState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await ensureSession();

        await Promise.allSettled([
          useStyleStore.getState().syncToServer().then(() => useStyleStore.getState().loadWardrobe()).then(() => migrateBase64Wardrobe()),
          useTravelStore.getState().hydrateFromDb(),
          useFitnessStore.getState().hydrateFromDb(),
          useLocationStore.getState().hydrateFromDb(),
          useCalendarStore.getState().hydrateFromDb(),
          useChatStore.getState().hydrateFromDb(),
        ]);

        if (!cancelled) {
          setBootState('ready');
        }
      } catch {
        if (!cancelled) {
          setBootState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (bootState === 'loading') {
    return (
      <div className="h-screen w-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading your workspace...
        </div>
      </div>
    );
  }

  if (bootState === 'error') {
    return (
      <div className="h-screen w-full flex items-center justify-center px-6 text-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div>
          <div className="mb-2 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Unable to start your session
          </div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Refresh and try again. If the problem continues, check that the API server is running.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Desktop Sidebar */}
      <div className="hidden sm:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="sm:hidden">
        <BottomTabBar />
      </div>
    </div>
  );
}
