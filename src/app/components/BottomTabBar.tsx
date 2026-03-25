import { Link, useLocation } from 'react-router';
import { Grid3x3, Palette, Plane, Dumbbell, Coffee, Bookmark, CalendarDays, Link2 } from 'lucide-react';
import { navItems } from '../types';

const iconMap: Record<string, React.ComponentType<any>> = {
  Grid3x3,
  Palette,
  Plane,
  Dumbbell,
  Coffee,
  Bookmark,
  CalendarDays,
  Link2,
};

export function BottomTabBar() {
  const location = useLocation();

  const getActiveId = (path: string): string => {
    if (path === '/') return 'all';
    return path.slice(1);
  };

  const activeId = getActiveId(location.pathname);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 h-16 flex items-center justify-around border-t"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-surface-elevated)',
      }}
    >
      {navItems.map((item) => {
        const Icon = iconMap[item.icon];
        const isActive = activeId === item.id;

        return (
          <Link
            key={item.id}
            to={item.path}
            className="flex flex-col items-center justify-center flex-1 h-full"
          >
            {Icon && (
              <Icon
                size={22}
                style={{
                  color: isActive ? item.color : 'var(--text-secondary)',
                  strokeWidth: isActive ? 2.5 : 2,
                }}
              />
            )}
            <span
              className="text-[10px] mt-1"
              style={{ color: isActive ? item.color : 'var(--text-secondary)' }}
            >
              {item.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
