import { Link, useLocation } from 'react-router';
import { Grid3x3, Palette, Plane, Dumbbell, Coffee, Settings, User } from 'lucide-react';
import { AgentId, agents } from '../types';

const iconMap = {
  Grid3x3,
  Palette,
  Plane,
  Dumbbell,
  Coffee,
};

export function Sidebar() {
  const location = useLocation();
  
  const getAgentIdFromPath = (path: string): AgentId => {
    if (path === '/') return 'all';
    const agentId = path.slice(1) as AgentId;
    return agentId in agents ? agentId : 'all';
  };
  
  const activeAgentId = getAgentIdFromPath(location.pathname);
  
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
      
      {/* Agent Tabs */}
      <nav className="flex-1 py-4 space-y-1">
        {Object.values(agents).map((agent) => {
          const Icon = iconMap[agent.icon as keyof typeof iconMap];
          const isActive = activeAgentId === agent.id;
          const path = agent.id === 'all' ? '/' : `/${agent.id}`;
          
          return (
            <Link
              key={agent.id}
              to={path}
              className="relative flex items-center h-12 lg:mx-2 lg:rounded-lg transition-colors group"
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
      <div className="py-4 space-y-1">
        <button 
          className="relative flex items-center h-12 w-full lg:mx-2 lg:rounded-lg transition-colors hover:bg-opacity-50"
          style={{ backgroundColor: 'transparent' }}
        >
          <div className="w-14 flex items-center justify-center">
            <Settings size={20} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <span className="hidden lg:block font-medium" style={{ color: 'var(--text-secondary)' }}>
            Settings
          </span>
        </button>
        
        <button 
          className="relative flex items-center h-12 w-full lg:mx-2 lg:rounded-lg transition-colors hover:bg-opacity-50"
          style={{ backgroundColor: 'transparent' }}
        >
          <div className="w-14 flex items-center justify-center">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
            >
              <User size={18} style={{ color: 'var(--text-secondary)' }} />
            </div>
          </div>
          <span className="hidden lg:block font-medium" style={{ color: 'var(--text-secondary)' }}>
            Profile
          </span>
        </button>
      </div>
    </div>
  );
}
