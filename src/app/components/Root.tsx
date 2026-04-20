import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { RemindersBell } from './RemindersBell';
import { useAuthStore } from '../../stores/auth';
import { startReminderPoller } from '../../lib/remindersPoller';

export function Root() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Run reminder poller only for authenticated sessions. Restart on auth toggle.
  useEffect(() => {
    if (!isAuthenticated) return;
    const handle = startReminderPoller();
    return () => handle.stop();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="h-screen w-full flex overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Desktop Sidebar */}
      <div className="hidden sm:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="absolute top-3 right-3 z-20">
          <RemindersBell />
        </div>
        <Outlet />
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="sm:hidden">
        <BottomTabBar />
      </div>
    </div>
  );
}
