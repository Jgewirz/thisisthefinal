import { Moon, Volume2, Sun, Power, AlertCircle, Check } from 'lucide-react';

interface HatchControlCardProps {
  data: {
    success: boolean;
    action: string;
    device?: string;
    message?: string;
    error?: string;
    sound?: string;
    volume?: number;
    brightness?: number;
    color?: { r: number; g: number; b: number };
  };
  agentColor: string;
}

function getActionIcon(action: string) {
  switch (action) {
    case 'set_sound':
      return Volume2;
    case 'set_volume':
      return Volume2;
    case 'set_brightness':
    case 'set_color':
      return Sun;
    case 'turn_on':
    case 'turn_off':
      return Power;
    default:
      return Moon;
  }
}

export function HatchControlCard({ data, agentColor }: HatchControlCardProps) {
  const Icon = data.success ? getActionIcon(data.action) : AlertCircle;

  return (
    <div
      className="rounded-xl p-4 border"
      style={{ borderColor: 'var(--bg-surface-elevated)', backgroundColor: 'var(--bg-surface)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: data.success ? agentColor + '20' : 'var(--warning)' + '20',
          }}
        >
          {data.success ? (
            <Icon size={16} style={{ color: agentColor }} />
          ) : (
            <AlertCircle size={16} style={{ color: 'var(--warning)' }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {data.device || 'Hatch'}
            </p>
            {data.success && (
              <Check size={14} style={{ color: 'var(--success)' }} />
            )}
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {data.message || data.error || 'Command sent'}
          </p>

          {/* Color preview swatch */}
          {data.color && data.success && (
            <div className="flex items-center gap-2 mt-2">
              <div
                className="w-5 h-5 rounded-full border"
                style={{
                  backgroundColor: `rgb(${data.color.r}, ${data.color.g}, ${data.color.b})`,
                  borderColor: 'var(--bg-surface-elevated)',
                }}
              />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                RGB({data.color.r}, {data.color.g}, {data.color.b})
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
