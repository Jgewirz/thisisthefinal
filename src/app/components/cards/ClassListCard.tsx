import { ExternalLink, MapPin, Star, AlertCircle, Dumbbell } from 'lucide-react';
import type { ClassListData, FitnessAggregatorLinkResult } from '../../types';

interface ClassListCardProps {
  data: ClassListData;
  agentColor: string;
}

function AggregatorLinks({
  links,
  agentColor,
}: {
  links: FitnessAggregatorLinkResult[];
  agentColor: string;
}) {
  if (!links || links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {links.map((l) => (
        <a
          key={l.id}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium hover:opacity-90"
          style={{
            backgroundColor: 'var(--bg-elevated, rgba(0,0,0,0.04))',
            color: agentColor,
            border: `1px solid ${agentColor}33`,
          }}
        >
          {l.name} <ExternalLink className="w-3 h-3" />
        </a>
      ))}
    </div>
  );
}

export function ClassListCard({ data, agentColor }: ClassListCardProps) {
  const studios = data.studios ?? [];
  const { activity, cityName, when } = data.query;
  const hadError = Boolean(data.providerError);

  const header = (
    <div
      className="flex items-center justify-between px-1 text-xs"
      style={{ color: 'var(--text-secondary)' }}
    >
      <div>
        <Dumbbell className="inline w-3 h-3 mr-1 opacity-60" />
        <span style={{ color: agentColor }}>{activity || 'fitness'}</span>
        {cityName ? ` · ${cityName}` : ''}
        {when ? ` · ${when}` : ''}
      </div>
      {studios.length > 0 && <div>{studios.length} studios</div>}
    </div>
  );

  if (studios.length === 0) {
    return (
      <div
        className="p-4 rounded-xl text-sm space-y-3"
        style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
      >
        {header}
        <div className="flex items-start gap-2">
          {hadError && (
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: agentColor }} />
          )}
          <div style={{ color: 'var(--text-primary)' }}>
            {hadError
              ? 'The live studio directory is temporarily unavailable. '
              : 'No live studios matched that activity nearby. '}
            Tap one of these to see real, up-to-date class schedules on the vendor site:
          </div>
        </div>
        <AggregatorLinks links={data.aggregatorLinks} agentColor={agentColor} />
      </div>
    );
  }

  return (
    <div
      className="p-3 rounded-xl space-y-2"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      {header}

      {studios.slice(0, 5).map((s) => {
        const bookingUrl = s.websiteUri || s.googleMapsUri || '#';
        return (
          <a
            key={s.id || s.name}
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 rounded-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--bg-elevated, rgba(0,0,0,0.03))' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div
                  className="font-semibold text-sm truncate"
                  style={{ color: 'var(--text-primary)' }}
                  title={s.name}
                >
                  {s.name}
                </div>
                {s.address && (
                  <div
                    className="flex items-center gap-1 text-xs mt-0.5 truncate"
                    style={{ color: 'var(--text-secondary)' }}
                    title={s.address}
                  >
                    <MapPin className="w-3 h-3 flex-shrink-0 opacity-60" />
                    <span className="truncate">{s.address}</span>
                  </div>
                )}
                {typeof s.rating === 'number' && (
                  <div
                    className="flex items-center gap-1 text-xs mt-0.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Star
                      className="w-3 h-3"
                      fill={agentColor}
                      style={{ color: agentColor }}
                    />
                    <span>
                      {s.rating.toFixed(1)}
                      {s.userRatingCount ? ` · ${s.userRatingCount} reviews` : ''}
                    </span>
                  </div>
                )}
              </div>
              {s.websiteUri && (
                <ExternalLink
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  style={{ color: agentColor }}
                />
              )}
            </div>
          </a>
        );
      })}

      <div className="pt-1 pl-1" style={{ color: 'var(--text-secondary)' }}>
        <div className="text-xs mb-1">See live class schedules on:</div>
        <AggregatorLinks links={data.aggregatorLinks} agentColor={agentColor} />
      </div>
    </div>
  );
}
