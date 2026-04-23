import { Link, useLocation } from 'react-router';
import { Grid3x3, Palette, Plane, Dumbbell, Coffee } from 'lucide-react';
import { AgentId, agents } from '../types';

const iconMap = { Grid3x3, Palette, Plane, Dumbbell, Coffee };

function getAgentIdFromPath(path: string): AgentId {
  if (path === '/') return 'all';
  const id = path.slice(1).split('/')[0] as AgentId;
  return id in agents ? id : 'all';
}

export function BottomTabBar() {
  const location = useLocation();
  const activeId = getAgentIdFromPath(location.pathname);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around z-30"
      style={{
        height: '60px',
        backgroundColor: 'rgba(19, 22, 28, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      {Object.values(agents).map((agent) => {
        const Icon = iconMap[agent.icon as keyof typeof iconMap];
        const isActive = activeId === agent.id;
        const path = agent.id === 'all' ? '/' : `/${agent.id}`;

        return (
          <Link
            key={agent.id}
            to={path}
            className="flex flex-col items-center justify-center flex-1 h-full transition-all duration-150 active:scale-90"
          >
            <div
              className="flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200"
              style={{
                backgroundColor: isActive ? `${agent.color}22` : 'transparent',
              }}
            >
              <Icon
                size={20}
                style={{
                  color: isActive ? agent.color : 'var(--text-muted)',
                  strokeWidth: isActive ? 2.4 : 1.8,
                  transition: 'color 0.15s',
                }}
              />
            </div>
            <span
              className="text-[10px] mt-0.5 font-medium tracking-wide"
              style={{
                color: isActive ? agent.color : 'var(--text-muted)',
                transition: 'color 0.15s',
              }}
            >
              {agent.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
