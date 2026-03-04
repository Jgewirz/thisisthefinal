import { Link, useLocation } from 'react-router';
import { Grid3x3, Palette, Plane, Dumbbell, Coffee, Settings, User, LogOut } from 'lucide-react';
import { AgentId, agents } from '../types';
import { useState } from 'react';
import { SettingsDialog } from './SettingsDialog';
import { ProfileDialog } from './ProfileDialog';
import { useAuthStore } from '../../stores/auth';

const iconMap = {
  Grid3x3,
  Palette,
  Plane,
  Dumbbell,
  Coffee,
};

export function Sidebar() {
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const user = useAuthStore((s) => s.user);
  
  const getAgentIdFromPath = (path: string): AgentId => {
    if (path === '/') return 'all';
    const agentId = path.slice(1) as AgentId;
    return agentId in agents ? agentId : 'all';
  };
  
  const activeAgentId = getAgentIdFromPath(location.pathname);
  
  return (
    <div 
      className="h-full w-14 lg:w-52 flex flex-col border-r relative z-10 overflow-hidden"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-surface-elevated)' }}
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
      
      {/* Agent Tabs */}
      <nav className="flex-1 py-4 space-y-1 px-0 lg:px-2">
        {Object.values(agents).map((agent) => {
          const Icon = iconMap[agent.icon as keyof typeof iconMap];
          const isActive = activeAgentId === agent.id;
          const path = agent.id === 'all' ? '/' : `/${agent.id}`;
          
          return (
            <Link
              key={agent.id}
              to={path}
              className="relative flex items-center h-12 lg:rounded-lg transition-all duration-150 group hover:brightness-125 active:scale-[0.97]"
              style={{
                backgroundColor: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
              }}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div 
                  className="absolute left-0 w-1 h-8 rounded-r-full lg:hidden"
                  style={{ backgroundColor: agent.color }}
                />
              )}
              
              {/* Icon */}
              <div className="w-14 flex items-center justify-center">
                <Icon 
                  size={20}
                  style={{ 
                    color: isActive ? agent.color : 'var(--text-secondary)',
                    strokeWidth: isActive ? 2.5 : 2
                  }}
                />
              </div>
              
              {/* Label (desktop only) */}
              <span 
                className="hidden lg:block font-medium"
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              >
                {agent.name}
              </span>
            </Link>
          );
        })}
      </nav>
      
      {/* Divider */}
      <div className="h-px mx-2" style={{ backgroundColor: 'var(--bg-surface-elevated)' }} />
      
      {/* Bottom utilities */}
      <div className="py-4 space-y-1 px-0 lg:px-2">
        <button 
          onClick={() => setShowSettings(true)}
          className="relative flex items-center h-12 w-full lg:rounded-lg transition-all duration-150 active:scale-[0.95]"
          style={{ backgroundColor: 'transparent' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.14)'}
          onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
        >
          <div className="w-14 flex items-center justify-center">
            <Settings size={20} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <span className="hidden lg:block font-medium" style={{ color: 'var(--text-secondary)' }}>
            Settings
          </span>
        </button>
        
        <button 
          onClick={() => setShowProfile(true)}
          className="relative flex items-center h-12 w-full lg:rounded-lg transition-all duration-150 active:scale-[0.95]"
          style={{ backgroundColor: 'transparent' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.14)'}
          onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
        >
          <div className="w-14 flex items-center justify-center">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
            >
              {user ? (
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {user.name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <User size={18} style={{ color: 'var(--text-secondary)' }} />
              )}
            </div>
          </div>
          <span className="hidden lg:block font-medium" style={{ color: 'var(--text-secondary)' }}>
            {user?.name || 'Profile'}
          </span>
        </button>
      </div>

      {/* Dialogs */}
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <ProfileDialog open={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}
