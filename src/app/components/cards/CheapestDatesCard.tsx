import { Calendar, ArrowRight, Plane } from 'lucide-react';

interface CheapestDateResult {
  departureDate: string;
  returnDate?: string;
  price: string;
  rawPrice: number;
}

interface CheapestDatesCardProps {
  data: {
    origin: string;
    destination: string;
    results: CheapestDateResult[];
  };
  agentColor: string;
  onSelectDate?: (origin: string, destination: string, date: string) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
}

export function CheapestDatesCard({ data, agentColor, onSelectDate }: CheapestDatesCardProps) {
  if (!data.results?.length) return null;

  const cheapest = data.results.reduce((min, r) => r.rawPrice < min.rawPrice ? r : min, data.results[0]);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-surface-elevated)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ backgroundColor: agentColor + '10' }}
      >
        <Calendar size={16} style={{ color: agentColor }} />
        <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
          Cheapest Flights: {data.origin}
        </span>
        <ArrowRight size={14} style={{ color: 'var(--text-secondary)' }} />
        <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
          {data.destination}
        </span>
      </div>

      {/* Date rows */}
      <div className="divide-y" style={{ borderColor: 'var(--bg-surface-elevated)' }}>
        {data.results.map((result, i) => {
          const isCheapest = result.rawPrice === cheapest.rawPrice;
          return (
            <div
              key={i}
              className="px-4 py-2.5 flex items-center justify-between"
              style={{
                borderColor: 'var(--bg-surface-elevated)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {formatDate(result.departureDate)}
                </div>
                {result.returnDate && (
                  <>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>-</span>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatDate(result.returnDate)}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span
                  className="text-sm font-semibold"
                  style={{ color: isCheapest ? agentColor : 'var(--text-primary)' }}
                >
                  {result.price}
                  {isCheapest && (
                    <span
                      className="ml-1.5 text-xs font-normal px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: agentColor + '20', color: agentColor }}
                    >
                      Best
                    </span>
                  )}
                </span>
                <button
                  onClick={() => onSelectDate?.(data.origin, data.destination, result.departureDate)}
                  className="px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-colors"
                  style={{
                    backgroundColor: agentColor + '15',
                    color: agentColor,
                  }}
                >
                  <Plane size={10} />
                  Search
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
