import { MapPin, Phone, Globe, Heart, ThumbsUp } from 'lucide-react';

interface PlaceCardProps {
  data: {
    name: string;
    phone: string;
    website: string;
    address: string;
    description: string;
    subtitle: string;
  };
  agentColor: string;
}

export function PlaceCard({ data, agentColor }: PlaceCardProps) {
  return (
    <div className="space-y-3">
      {/* Business info */}
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <MapPin size={18} style={{ color: agentColor, flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {data.name}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 pl-7">
          <Phone size={16} style={{ color: 'var(--text-secondary)' }} />
          <a 
            href={`tel:${data.phone}`}
            className="hover:underline"
            style={{ color: agentColor }}
          >
            {data.phone}
          </a>
        </div>
        
        <div className="flex items-center gap-2 pl-7">
          <Globe size={16} style={{ color: 'var(--text-secondary)' }} />
          <a 
            href={`https://${data.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: agentColor }}
          >
            {data.website}
          </a>
        </div>
      </div>
      
      {/* Link preview card */}
      <div 
        className="border rounded-lg overflow-hidden"
        style={{ borderColor: 'var(--bg-surface-elevated)' }}
      >
        <div 
          className="p-3"
          style={{ backgroundColor: 'var(--bg-surface)' }}
        >
          <div className="flex items-start gap-3">
            <div 
              className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
            >
              <Globe size={20} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm mb-1 truncate" style={{ color: 'var(--text-primary)' }}>
                {data.description}
              </div>
              <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                {data.subtitle}
              </p>
              <div className="text-xs mt-1" style={{ color: agentColor }}>
                {data.website}
              </div>
            </div>
          </div>
        </div>
        
        {/* Reaction bar */}
        <div 
          className="px-3 py-2 flex items-center gap-4 border-t"
          style={{ 
            backgroundColor: 'var(--bg-surface)', 
            borderColor: 'var(--bg-surface-elevated)' 
          }}
        >
          <button className="flex items-center gap-1 group">
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#FF6B6B' }}
            >
              <Heart size={12} fill="white" color="white" />
            </div>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              2
            </span>
          </button>
          
          <button className="flex items-center gap-1 group">
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#4A9EFF' }}
            >
              <ThumbsUp size={12} fill="white" color="white" />
            </div>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              1
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
