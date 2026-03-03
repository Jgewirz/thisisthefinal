interface ColorSeasonCardProps {
  data: {
    season: string;
    colors: string[];
    metals: string;
  };
  agentColor: string;
}

export function ColorSeasonCard({ data, agentColor }: ColorSeasonCardProps) {
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
      
      {/* Metals */}
      <div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Your best metals: <span style={{ color: 'var(--text-primary)' }}>{data.metals}</span>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <button
          className="flex-1 px-4 py-2 rounded-full border transition-colors"
          style={{ 
            borderColor: agentColor,
            color: agentColor 
          }}
        >
          See makeup tips
        </button>
        <button
          className="flex-1 px-4 py-2 rounded-full border transition-colors"
          style={{ 
            borderColor: agentColor,
            color: agentColor 
          }}
        >
          Best outfit colors
        </button>
      </div>
    </div>
  );
}
