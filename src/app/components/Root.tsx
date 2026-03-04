import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { useStyleStore } from '../../stores/style';
import { migrateBase64Wardrobe } from '../../lib/migration';

export function Root() {
  useEffect(() => {
    // Load wardrobe from server, then run one-time base64 migration
    useStyleStore.getState().loadWardrobe().then(() => {
      migrateBase64Wardrobe();
    });
  }, []);

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
