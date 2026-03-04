import { Outlet, Navigate } from 'react-router';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { useAuthStore } from '../../stores/auth';

export function Root() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

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
