import { MapPin, Calendar, Navigation } from 'lucide-react';

interface FitnessClassCardProps {
  data: {
    studioName: string;
    className: string;
    dateTime: string;
    distance: string;
    imageUrl?: string;
  };
  agentColor: string;
}

export function FitnessClassCard({ data, agentColor }: FitnessClassCardProps) {
  return (
    <div 
      className="rounded-xl overflow-hidden border"
      style={{ 
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-surface-elevated)'
      }}
    >
      {/* Image placeholder */}
      {data.imageUrl && (
        <div className="w-full h-32 bg-gradient-to-br" style={{ 
          backgroundImage: `linear-gradient(135deg, ${agentColor}40, ${agentColor}20)` 
        }} />
      )}
      
      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <h4 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {data.className}
          </h4>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {data.studioName}
          </p>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ color: 'var(--text-primary)' }}>{data.dateTime}</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ color: 'var(--text-primary)' }}>{data.distance}</span>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <button
            className="flex-1 px-4 py-2 rounded-full transition-colors"
            style={{ 
              backgroundColor: agentColor,
              color: 'var(--bg-primary)'
            }}
          >
            Book
          </button>
          <button
            className="px-4 py-2 rounded-full border transition-colors flex items-center gap-2"
            style={{ 
              borderColor: agentColor,
              color: agentColor 
            }}
          >
            <Navigation size={16} />
            Directions
          </button>
        </div>
      </div>
    </div>
  );
}
