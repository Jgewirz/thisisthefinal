import { useEffect, useState } from 'react';
import { Outlet, useSearchParams } from 'react-router';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { LoginScreen } from './LoginScreen';
import { useStyleStore } from '../../stores/style';
import { useTravelStore } from '../../stores/travel';
import { useFitnessStore } from '../../stores/fitness';
import { useLocationStore } from '../../stores/location';
import { useCalendarStore } from '../../stores/calendar';
import { useChatStore } from '../../stores/chat';
import { useUserStore } from '../../stores/user';
import { migrateBase64Wardrobe } from '../../lib/migration';
import { ensureSession } from '../../lib/session';

type BootState = 'loading' | 'login' | 'ready' | 'error';

export function Root() {
  const [bootState, setBootState] = useState<BootState>('loading');
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Ensure anonymous session cookie exists
        await ensureSession();

        // Fetch user profile (may be anonymous or Google-linked)
        await useUserStore.getState().fetchUser();

        const user = useUserStore.getState().user;

        // If user has no Google account and hasn't opted to skip login, show login screen
        // But if they came back from a login flow (URL has ?login=), skip the screen
        const loginParam = searchParams.get('login');
        if (loginParam) {
          // Clean up the URL param
          searchParams.delete('login');
          setSearchParams(searchParams, { replace: true });
        }

        const hasChosenGuest = localStorage.getItem('girlbot-guest-mode') === 'true';
        const isAuthenticated = user?.provider === 'google';

        if (!isAuthenticated && !hasChosenGuest && !loginParam) {
          if (!cancelled) setBootState('login');
          return;
        }

        // Hydrate all stores
        await Promise.allSettled([
          useStyleStore.getState().syncToServer().then(() => useStyleStore.getState().loadWardrobe()).then(() => migrateBase64Wardrobe()),
          useTravelStore.getState().hydrateFromDb(),
          useFitnessStore.getState().hydrateFromDb(),
          useLocationStore.getState().hydrateFromDb(),
          useCalendarStore.getState().hydrateFromDb(),
          useChatStore.getState().hydrateFromDb(),
        ]);

        if (!cancelled) setBootState('ready');
      } catch {
        if (!cancelled) setBootState('error');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleContinueAsGuest = async () => {
    localStorage.setItem('girlbot-guest-mode', 'true');
    setBootState('loading');

    try {
      await Promise.allSettled([
        useStyleStore.getState().syncToServer().then(() => useStyleStore.getState().loadWardrobe()).then(() => migrateBase64Wardrobe()),
        useTravelStore.getState().hydrateFromDb(),
        useFitnessStore.getState().hydrateFromDb(),
        useLocationStore.getState().hydrateFromDb(),
        useCalendarStore.getState().hydrateFromDb(),
        useChatStore.getState().hydrateFromDb(),
      ]);
      setBootState('ready');
    } catch {
      setBootState('error');
    }
  };

  if (bootState === 'loading') {
    return (
      <div className="h-screen w-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading your workspace...
        </div>
      </div>
    );
  }

  if (bootState === 'login') {
    return <LoginScreen onContinueAsGuest={handleContinueAsGuest} />;
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
