import { Link, useLocation } from 'react-router';
import { Grid3x3, Palette, Plane, Dumbbell, Coffee } from 'lucide-react';
import { AgentId, agents } from '../types';

const iconMap = {
  Grid3x3,
  Palette,
  Plane,
  Dumbbell,
  Coffee,
};

export function BottomTabBar() {
  const location = useLocation();
  
  const getAgentIdFromPath = (path: string): AgentId => {
    if (path === '/') return 'all';
    const agentId = path.slice(1) as AgentId;
    return agentId in agents ? agentId : 'all';
  };
  
  const activeAgentId = getAgentIdFromPath(location.pathname);
  
  return (
    <div 
      className="fixed bottom-0 left-0 right-0 h-16 flex items-center justify-around border-t"
      style={{ 
        backgroundColor: 'var(--bg-surface)', 
        borderColor: 'var(--bg-surface-elevated)' 
      }}
    >
      {Object.values(agents).map((agent) => {
        const Icon = iconMap[agent.icon as keyof typeof iconMap];
        const isActive = activeAgentId === agent.id;
        const path = agent.id === 'all' ? '/' : `/${agent.id}`;
        
        return (
          <Link
            key={agent.id}
            to={path}
            className="flex flex-col items-center justify-center w-16 h-full transition-all duration-150 active:scale-90 active:opacity-70"
          >
            <Icon 
              size={22}
              style={{ 
                color: isActive ? agent.color : 'var(--text-secondary)',
                strokeWidth: isActive ? 2.5 : 2
              }}
            />
            <span 
              className="text-xs mt-1"
              style={{ color: isActive ? agent.color : 'var(--text-secondary)' }}
            >
              {agent.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
