interface ColorSeasonCardProps {
  data: {
    season: string;
    colors: string[];
    metals: string;
    avoidColors?: string[];
  };
  agentColor: string;
  onAction?: (text: string) => void;
}

export function ColorSeasonCard({ data, agentColor, onAction }: ColorSeasonCardProps) {
  return (
    <div
      className="p-4 rounded-xl space-y-4"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      {/* Season name */}
      <div className="text-center">
        <h3 className="text-2xl font-semibold mb-1" style={{ color: agentColor }}>
          {data.season}
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Your color season
        </p>
      </div>

      {/* Color swatches */}
      <div>
        <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
          Your best colors
        </div>
        <div className="flex gap-2 flex-wrap">
          {data.colors.map((color, idx) => (
            <div
              key={idx}
              className="w-12 h-12 rounded-full border-2"
              style={{
                backgroundColor: color,
                borderColor: 'var(--bg-surface-elevated)'
              }}
            />
          ))}
        </div>
      </div>

      {/* Avoid colors */}
      {data.avoidColors && data.avoidColors.length > 0 && (
        <div>
          <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            Colors to avoid
          </div>
          <div className="flex gap-2 flex-wrap">
            {data.avoidColors.map((color, idx) => (
              <div
                key={idx}
                className="w-10 h-10 rounded-full border-2 relative opacity-60"
                style={{
                  backgroundColor: color,
                  borderColor: 'var(--bg-surface-elevated)',
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-full h-0.5 rotate-45"
                    style={{ backgroundColor: 'var(--error)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metals */}
      <div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Your best metals: <span style={{ color: 'var(--text-primary)' }}>{data.metals}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <button
          className="flex-1 px-4 py-2 rounded-full border transition-colors hover:bg-opacity-10"
          style={{
            borderColor: agentColor,
            color: agentColor
          }}
          onClick={() => onAction?.(`Based on my ${data.season} color season, what are the best makeup colors and techniques for me?`)}
        >
          See makeup tips
        </button>
        <button
          className="flex-1 px-4 py-2 rounded-full border transition-colors hover:bg-opacity-10"
          style={{
            borderColor: agentColor,
            color: agentColor
          }}
          onClick={() => onAction?.(`What are the best outfit color combinations for a ${data.season}?`)}
        >
          Best outfit colors
        </button>
      </div>
    </div>
  );
}
