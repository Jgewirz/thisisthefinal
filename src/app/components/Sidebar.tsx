import { Link, useLocation, useNavigate } from 'react-router';
import { Grid3x3, Palette, Plane, Dumbbell, Coffee, Bookmark, CalendarDays, Settings, Link2, User, LogOut, LogIn } from 'lucide-react';
import { navItems } from '../types';
import { useUserStore } from '../../stores/user';
import { loginWithGoogle } from '../../lib/session';

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

export function Sidebar() {
  const location = useLocation();
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);

  const getActiveId = (path: string): string => {
    if (path === '/') return 'all';
    return path.slice(1); // e.g. "/calendar" → "calendar", "/style" → "style"
  };

  const navigate = useNavigate();
  const activeId = getActiveId(location.pathname);
  const isGoogleUser = user?.provider === 'google';

  return (
    <div
      className="h-full w-14 lg:w-52 flex flex-col"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-center lg:justify-start lg:px-4 border-b" style={{ borderColor: 'var(--bg-surface-elevated)' }}>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
          style={{ backgroundColor: 'var(--accent-global)', color: 'var(--bg-primary)' }}
        >
          G
        </div>
        <span className="hidden lg:block ml-3 font-semibold" style={{ color: 'var(--text-primary)' }}>
          GirlBot
        </span>
      </div>

      {/* Nav Tabs */}
      <nav className="flex-1 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = activeId === item.id;

          return (
            <Link
              key={item.id}
              to={item.path}
              className="relative flex items-center h-12 lg:mx-2 lg:rounded-lg transition-colors group"
              style={{
                backgroundColor: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
              }}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div
                  className="absolute left-0 w-1 h-8 rounded-r-full lg:hidden"
                  style={{ backgroundColor: item.color }}
                />
              )}

              {/* Icon */}
              <div className="w-14 flex items-center justify-center">
                {Icon && (
                  <Icon
                    size={20}
                    style={{
                      color: isActive ? item.color : 'var(--text-secondary)',
                      strokeWidth: isActive ? 2.5 : 2,
                    }}
                  />
                )}
              </div>

              {/* Label (desktop only) */}
              <span
                className="hidden lg:block font-medium"
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="h-px mx-2" style={{ backgroundColor: 'var(--bg-surface-elevated)' }} />

      {/* Bottom utilities */}
      <div className="py-4 space-y-1">
        <button
          onClick={() => navigate('/accounts')}
          className="relative flex items-center h-12 w-full lg:mx-2 lg:rounded-lg transition-colors hover:bg-opacity-50"
          style={{ backgroundColor: activeId === 'accounts' ? 'var(--bg-surface-elevated)' : 'transparent' }}
        >
          <div className="w-14 flex items-center justify-center">
            <Link2 size={20} style={{ color: activeId === 'accounts' ? 'var(--accent-global)' : 'var(--text-secondary)' }} />
          </div>
          <span
            className="hidden lg:block font-medium"
            style={{ color: activeId === 'accounts' ? 'var(--text-primary)' : 'var(--text-secondary)' }}
          >
            Accounts
          </span>
        </button>

        {/* User Profile / Auth */}
        {isGoogleUser ? (
          <div className="relative flex items-center h-12 w-full lg:mx-2 lg:rounded-lg group">
            {/* Avatar + Name */}
            <div className="w-14 flex items-center justify-center">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ backgroundColor: 'var(--accent-global)', color: 'var(--bg-primary)' }}
                >
                  {(user.displayName || user.email || '?')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="hidden lg:flex flex-1 items-center justify-between pr-2 min-w-0">
              <span
                className="font-medium truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {user.displayName || user.email || 'User'}
              </span>
              <button
                onClick={logout}
                className="ml-2 p-1 rounded-md transition-colors hover:bg-white/10"
                title="Sign out"
              >
                <LogOut size={16} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {/* Mobile: tap avatar to logout */}
            <button
              onClick={logout}
              className="absolute inset-0 lg:hidden"
              aria-label="Sign out"
            />
          </div>
        ) : (
          <button
            onClick={() => loginWithGoogle()}
            className="relative flex items-center h-12 w-full lg:mx-2 lg:rounded-lg transition-colors hover:bg-white/5"
            style={{ backgroundColor: 'transparent' }}
          >
            <div className="w-14 flex items-center justify-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
              >
                <LogIn size={18} style={{ color: 'var(--text-secondary)' }} />
              </div>
            </div>
            <span className="hidden lg:block font-medium" style={{ color: 'var(--text-secondary)' }}>
              Sign in
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
