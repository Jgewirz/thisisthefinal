import { ExternalLink, MapPin, Star, AlertCircle, Dumbbell } from 'lucide-react';
import type { ClassListData, FitnessAggregatorLinkResult } from '../../types';
import { SaveButton } from '../SaveButton';
import { useMemo, useState } from 'react';

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

function RatingBadge({ rating, agentColor }: { rating: number; agentColor: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
      style={{ backgroundColor: `${agentColor}22`, color: agentColor }}
      aria-label={`Rating ${rating.toFixed(1)}`}
    >
      <Star className="w-3 h-3" fill={agentColor} style={{ color: agentColor }} />
      {rating.toFixed(1)}
    </span>
  );
}

export function ClassListCard({ data, agentColor }: ClassListCardProps) {
  const studios = data.studios ?? [];
  const { activity, cityName, when } = data.query;
  const hadError = Boolean(data.providerError);
  const [expanded, setExpanded] = useState(false);
  const defaultVisible = 5;
  const hasMore = studios.length > defaultVisible;

  const visibleStudios = useMemo(() => {
    if (!hasMore) return studios;
    return expanded ? studios : studios.slice(0, defaultVisible);
  }, [studios, expanded, hasMore]);

  const headerLeft = (
    <div className="flex items-center gap-1.5 min-w-0">
      <Dumbbell className="w-3.5 h-3.5 shrink-0" style={{ color: agentColor }} />
      <span className="text-xs font-semibold truncate" style={{ color: agentColor }}>
        {activity || 'fitness'}
      </span>
      {(cityName || when) && (
        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {cityName ? cityName : ''}
          {cityName && when ? ' · ' : ''}
          {when ? when : ''}
        </span>
      )}
    </div>
  );

  if (studios.length === 0) {
    return (
      <div
        className="p-4 rounded-xl text-sm space-y-3"
        style={{
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-secondary)',
          border: `1px solid ${agentColor}22`,
        }}
      >
        <div className="flex items-center justify-between">
          {headerLeft}
        </div>
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
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          backgroundColor: `${agentColor}12`,
          borderBottom: `1px solid ${agentColor}22`,
          borderLeft: `1px solid ${agentColor}22`,
          borderRight: `1px solid ${agentColor}22`,
          borderTop: `1px solid ${agentColor}22`,
        }}
      >
        {headerLeft}
        <span
          className="shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ml-2"
          style={{ backgroundColor: `${agentColor}22`, color: agentColor }}
        >
          {studios.length} studios
        </span>
      </div>

      {/* Studio rows */}
      <ul
        className="divide-y"
        style={{
          borderColor: `${agentColor}12`,
          borderLeft: `1px solid ${agentColor}22`,
          borderRight: `1px solid ${agentColor}22`,
        }}
      >
        {visibleStudios.map((s) => {
          const bookingUrl = s.websiteUri || s.googleMapsUri || '#';
          const externalId = s.id || s.name;
          return (
            <li key={externalId} className="relative">
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-3 pr-10 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--bg-primary)' }}
                aria-label={`Open ${s.name}`}
              >
                <div className="font-semibold text-sm leading-snug mb-1" style={{ color: 'var(--text-primary)' }}>
                  {s.name}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  {typeof s.rating === 'number' && <RatingBadge rating={s.rating} agentColor={agentColor} />}
                  {s.userRatingCount ? (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {s.userRatingCount} reviews
                    </span>
                  ) : null}
                  {s.websiteUri ? (
                    <span className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                      Website
                    </span>
                  ) : null}
                </div>

                {s.address && (
                  <div className="flex items-center gap-1 text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                    <MapPin className="w-2.5 h-2.5 shrink-0 opacity-60" />
                    <span className="truncate">{s.address}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span
                    className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium"
                    style={{ backgroundColor: agentColor, color: '#fff' }}
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </a>

              <div className="absolute top-3 right-2">
                <SaveButton
                  kind="studio"
                  externalId={externalId}
                  data={{
                    name: s.name,
                    address: s.address,
                    rating: s.rating,
                    websiteUri: s.websiteUri,
                    googleMapsUri: s.googleMapsUri,
                  }}
                  agentColor={agentColor}
                  label={`studio ${s.name}`}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <div
          className="px-3 py-2 flex items-center justify-center"
          style={{
            borderLeft: `1px solid ${agentColor}22`,
            borderRight: `1px solid ${agentColor}22`,
            borderTop: `1px solid ${agentColor}12`,
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-90"
            style={{
              color: agentColor,
              backgroundColor: `${agentColor}14`,
              border: `1px solid ${agentColor}33`,
            }}
            aria-label={expanded ? 'Show fewer studios' : 'Show all studios'}
          >
            {expanded ? 'Show less' : `Show all (${studios.length})`}
          </button>
        </div>
      )}

      {/* Footer: aggregator links */}
      <div
        className="px-3 pt-2 pb-3"
        style={{
          borderTop: `1px solid ${agentColor}22`,
          borderLeft: `1px solid ${agentColor}22`,
          borderRight: `1px solid ${agentColor}22`,
          borderBottom: `1px solid ${agentColor}22`,
        }}
      >
        <div className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
          See live class schedules on:
        </div>
        <AggregatorLinks links={data.aggregatorLinks} agentColor={agentColor} />
      </div>
    </div>
  );
}
