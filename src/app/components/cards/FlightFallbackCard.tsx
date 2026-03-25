import { ExternalLink, Plane } from 'lucide-react';

interface FlightFallbackData {
  origin: string;
  destination: string;
  originCityName: string;
  destinationCityName: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  links: {
    googleFlights: string;
    skyscanner: string;
    kayak: string;
  };
}

export function FlightFallbackCard({ data }: { data: FlightFallbackData }) {
  const dateObj = new Date(data.departureDate + 'T12:00:00');
  const friendlyDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const returnDateObj = data.returnDate ? new Date(data.returnDate + 'T12:00:00') : null;
  const friendlyReturn = returnDateObj
    ? returnDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const LINK_ITEMS = [
    { label: 'Google Flights', url: data.links.googleFlights, color: '#4285F4' },
    { label: 'Skyscanner', url: data.links.skyscanner, color: '#0770E3' },
    { label: 'Kayak', url: data.links.kayak, color: '#FF690F' },
  ];

  return (
    <div
      className="rounded-xl overflow-hidden w-full max-w-sm"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-2">
        <Plane size={16} style={{ color: 'var(--accent-travel)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {data.originCityName} → {data.destinationCityName}
        </span>
      </div>

      <div className="px-4 pb-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {friendlyDate}{friendlyReturn ? ` – ${friendlyReturn}` : ''} · {data.adults} traveler{data.adults !== 1 ? 's' : ''}
      </div>

      {/* Links */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        {LINK_ITEMS.map((item) => (
          <a
            key={item.label}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          >
            <span>{item.label}</span>
            <ExternalLink size={14} style={{ color: 'var(--text-secondary)' }} />
          </a>
        ))}
      </div>
    </div>
  );
}
