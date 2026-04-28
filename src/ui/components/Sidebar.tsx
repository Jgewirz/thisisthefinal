import { Link, useLocation } from 'react-router';
import { Grid3x3, Palette, Plane, Dumbbell, Coffee, Settings, User } from 'lucide-react';
import { AgentId, agents } from '../../app/types';
import { useState } from 'react';
import { SettingsDialog } from '../../app/components/SettingsDialog';
import { ProfileDialog } from '../../app/components/ProfileDialog';
import { useAuthStore } from '../../stores/auth';

const iconMap = { Grid3x3, Palette, Plane, Dumbbell, Coffee };

function getAgentIdFromPath(path: string): AgentId {
  if (path === '/') return 'all';
  const id = path.slice(1).split('/')[0] as AgentId;
  return id in agents ? id : 'all';
}

export function Sidebar() {
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const user = useAuthStore((s) => s.user);
  const activeId = getAgentIdFromPath(location.pathname);

  return (
    <div
      className="h-full flex flex-col relative z-10"
      style={{
        width: '64px',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      <div className="h-14 flex items-center justify-center shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold select-none"
          style={{
            background: 'linear-gradient(135deg, #7c6afc 0%, #e879a0 100%)',
            color: '#fff',
            boxShadow: '0 2px 12px rgba(124,106,252,0.4)',
          }}
        >
          G
        </div>
      </div>

      <nav className="flex-1 flex flex-col items-center gap-1 py-3 overflow-y-auto">
        {Object.values(agents).map((agent) => {
          const Icon = iconMap[agent.icon as keyof typeof iconMap];
          const isActive = activeId === agent.id;
          const path = agent.id === 'all' ? '/' : `/${agent.id}`;

          return (
            <Link
              key={agent.id}
              to={path}
              title={agent.name}
              className="relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 active:scale-90"
              style={{
                backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                boxShadow: isActive ? `0 0 0 1px ${agent.color}33` : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full"
                  style={{ background: agent.color }}
                />
              )}
              <Icon
                size={20}
                style={{
                  color: isActive ? agent.color : 'var(--text-muted)',
                  strokeWidth: isActive ? 2.5 : 1.8,
                  transition: 'color 0.15s',
                }}
              />
            </Link>
          );
        })}
      </nav>

      <div style={{ height: '1px', margin: '0 12px', backgroundColor: 'var(--border-subtle)' }} />

      <div className="flex flex-col items-center gap-1 py-3">
        <button
          onClick={() => setShowSettings(true)}
          title="Settings"
          className="flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 active:scale-90"
          style={{ backgroundColor: 'transparent' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Settings size={19} style={{ color: 'var(--text-muted)', strokeWidth: 1.8 }} />
        </button>

        <button
          onClick={() => setShowProfile(true)}
          title={user?.name || 'Profile'}
          className="flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-150 active:scale-90"
          style={{ backgroundColor: 'transparent' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold"
            style={{
              background: user ? 'linear-gradient(135deg, #7c6afc 0%, #e879a0 100%)' : 'var(--bg-surface-elevated)',
              color: '#fff',
            }}
          >
            {user ? user.name.charAt(0).toUpperCase() : <User size={14} />}
          </div>
        </button>
      </div>

      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <ProfileDialog open={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}

