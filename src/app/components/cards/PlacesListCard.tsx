import { ExternalLink, MapPin, Star } from 'lucide-react';
import type { PlaceResult } from '../../types';

interface PlacesListCardProps {
  data: { query: string; places: PlaceResult[] };
  agentColor: string;
}

function priceSymbol(level?: string): string {
  switch (level) {
    case 'PRICE_LEVEL_FREE':
      return 'Free';
    case 'PRICE_LEVEL_INEXPENSIVE':
      return '$';
    case 'PRICE_LEVEL_MODERATE':
      return '$$';
    case 'PRICE_LEVEL_EXPENSIVE':
      return '$$$';
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return '$$$$';
    default:
      return '';
  }
}

function directionsUrl(p: PlaceResult): string {
  if (p.googleMapsUri) return p.googleMapsUri;
  const q = encodeURIComponent(`${p.name} ${p.address}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function PlacesListCard({ data, agentColor }: PlacesListCardProps) {
  const places = data.places ?? [];

  if (places.length === 0) {
    return (
      <div
        className="p-4 rounded-xl text-sm"
        style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
      >
        No results found for <span style={{ color: agentColor }}>{data.query}</span>. Try widening
        your search or enabling location.
      </div>
    );
  }

  return (
    <div
      className="p-3 rounded-xl space-y-2"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      <div className="flex items-center gap-2 px-1">
        <MapPin size={14} style={{ color: agentColor }} />
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {places.length} result{places.length === 1 ? '' : 's'} for{' '}
          <span style={{ color: agentColor }}>{data.query}</span>
        </span>
      </div>

      <ul className="space-y-2">
        {places.map((p) => (
          <li
            key={p.id}
            className="p-3 rounded-lg flex flex-col gap-1.5"
            style={{ backgroundColor: 'var(--bg-primary)' }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div
                  className="font-semibold truncate"
                  style={{ color: 'var(--text-primary)' }}
                  title={p.name}
                >
                  {p.name}
                </div>
                <div
                  className="text-xs truncate"
                  style={{ color: 'var(--text-secondary)' }}
                  title={p.address}
                >
                  {p.address}
                </div>
              </div>
              {typeof p.rating === 'number' && (
                <div
                  className="flex items-center gap-1 flex-shrink-0"
                  title={`${p.userRatingCount ?? 0} reviews`}
                >
                  <Star size={12} fill={agentColor} style={{ color: agentColor }} />
                  <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                    {p.rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {priceSymbol(p.priceLevel) && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: agentColor + '20', color: agentColor }}
                >
                  {priceSymbol(p.priceLevel)}
                </span>
              )}
              <a
                href={directionsUrl(p)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                style={{ backgroundColor: agentColor, color: 'var(--bg-primary)' }}
              >
                Directions
                <ExternalLink size={11} />
              </a>
              {p.websiteUri && (
                <a
                  href={p.websiteUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded-md inline-flex items-center gap-1 border transition-opacity hover:opacity-80"
                  style={{ borderColor: agentColor, color: agentColor }}
                >
                  Website
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
