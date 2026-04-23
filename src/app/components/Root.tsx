import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { useAuthStore } from '../../stores/auth';
import { startReminderPoller } from '../../lib/remindersPoller';
import { useStatusStore } from '../../stores/status';

export function Root() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loadStatus = useStatusStore((s) => s.load);

  // Provider status is public (booleans only); load it once per session so
  // the per-agent header pill reflects reality before the user types.
  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

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
    <div className="h-screen w-full flex overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Desktop Sidebar */}
      <div className="hidden sm:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Outlet />
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="sm:hidden">
        <BottomTabBar />
      </div>
    </div>
  );
}
