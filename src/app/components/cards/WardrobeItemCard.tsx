import { Check } from 'lucide-react';

interface WardrobeItemCardProps {
  data: {
    category: string;
    color: string;
    colorHex: string;
    style: string;
    seasons: string[];
    occasions: string[];
    pairsWith: string[];
  };
  agentColor: string;
}

export function WardrobeItemCard({ data, agentColor }: WardrobeItemCardProps) {
  return (
    <div
      className="p-4 rounded-xl space-y-3"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: agentColor }}>
          Added to Wardrobe
        </h3>
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--success)' }}
        >
          <Check size={14} style={{ color: 'var(--bg-primary)' }} />
        </div>
      </div>

      {/* Category + Style */}
      <div className="flex items-center gap-2">
        <span
          className="px-3 py-1 rounded-full text-sm capitalize"
          style={{ backgroundColor: agentColor + '20', color: agentColor }}
        >
          {data.category}
        </span>
        <span
          className="px-3 py-1 rounded-full text-sm capitalize"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            color: 'var(--text-primary)',
          }}
        >
          {data.style}
        </span>
      </div>

      {/* Color */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full border"
          style={{
            backgroundColor: data.colorHex,
            borderColor: 'var(--bg-surface-elevated)',
          }}
        />
        <span className="text-sm capitalize" style={{ color: 'var(--text-primary)' }}>
          {data.color}
        </span>
      </div>

      {/* Seasons */}
      {data.seasons?.length > 0 && (
        <div>
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            Best seasons
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.seasons.map((s, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-xs capitalize border"
                style={{ borderColor: agentColor, color: agentColor }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pairs with */}
      {data.pairsWith?.length > 0 && (
        <div>
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
            Pairs with
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.pairsWith.map((item, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-xs border"
                style={{
                  borderColor: 'var(--bg-surface-elevated)',
                  color: 'var(--text-primary)',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
