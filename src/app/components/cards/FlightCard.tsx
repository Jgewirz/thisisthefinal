import { Plane, Clock } from 'lucide-react';

interface FlightCardProps {
  data: {
    airline: string;
    departure: {
      city: string;
      time: string;
    };
    arrival: {
      city: string;
      time: string;
    };
    duration: string;
    stops: number;
    price: string;
    tier: 'Budget' | 'Balanced' | 'Premium';
  };
  agentColor: string;
}

export function FlightCard({ data, agentColor }: FlightCardProps) {
  const tierColors = {
    Budget: 'var(--success)',
    Balanced: 'var(--accent-travel)',
    Premium: 'var(--accent-lifestyle)'
  };
  
  return (
    <div 
      className="p-4 rounded-xl border"
      style={{ 
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-surface-elevated)'
      }}
    >
      {/* Tier label */}
      <div 
        className="inline-block px-2 py-0.5 rounded text-xs font-medium mb-3"
        style={{ 
          backgroundColor: tierColors[data.tier] + '20',
          color: tierColors[data.tier]
        }}
      >
        {data.tier}
      </div>
      
      {/* Airline */}
      <div className="flex items-center gap-2 mb-4">
        <div 
          className="w-8 h-8 rounded flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
        >
          <Plane size={16} style={{ color: agentColor }} />
        </div>
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {data.airline}
        </span>
      </div>
      
      {/* Flight route */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <div className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {data.departure.time}
          </div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {data.departure.city}
          </div>
        </div>
        
        <div className="flex-1 flex flex-col items-center px-4">
          <div className="w-full h-px mb-1" style={{ backgroundColor: 'var(--text-secondary)' }} />
          <div className="flex items-center gap-1">
            <Clock size={12} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {data.duration}
            </span>
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            {data.stops === 0 ? 'Nonstop' : `${data.stops} stop${data.stops > 1 ? 's' : ''}`}
          </div>
        </div>
        
        <div className="flex-1 text-right">
          <div className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            {data.arrival.time}
          </div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {data.arrival.city}
          </div>
        </div>
      </div>
      
      {/* Price and action */}
      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--bg-surface-elevated)' }}>
        <div className="text-2xl font-semibold" style={{ color: agentColor }}>
          {data.price}
        </div>
        <button
          className="px-6 py-2 rounded-full transition-colors"
          style={{ 
            backgroundColor: agentColor,
            color: 'var(--bg-primary)'
          }}
        >
          Select
        </button>
      </div>
    </div>
  );
}
