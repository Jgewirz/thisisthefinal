import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { useAuthStore } from '../../stores/auth';
import { startReminderPoller } from '../../core/reminders';
import { useStatusStore } from '../../stores/status';

export function Root() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loadStatus = useStatusStore((s) => s.load);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const handle = startReminderPoller();
    return () => handle.stop();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div
      className="h-screen w-full flex overflow-hidden"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <div className="hidden sm:block">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0 relative">
        <Outlet />
      </div>

      <div className="sm:hidden">
        <BottomTabBar />
      </div>
    </div>
  );
}

