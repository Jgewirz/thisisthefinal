import { MapPin, Phone, Globe, Star, ExternalLink, Clock, Bookmark, BookmarkCheck, CalendarPlus, Check, Dumbbell, User } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────

interface StudioClass {
  name: string;
  time: string;
  endTime?: string;
  instructor?: string;
  duration?: string;
  level?: string;
  category?: string;
  spotsRemaining?: number | null;
  imageUrl?: string;
}

export interface FitnessStudioCardData {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: string | null;
  types: string[];
  phone: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  openNow: boolean | null;
  photoUrl: string | null;
  editorialSummary: string | null;
  todayClasses: StudioClass[];
  scheduleSource: 'mindbody' | 'website' | 'cached' | 'unavailable';
}

interface FitnessStudioCardProps {
  data: FitnessStudioCardData;
  agentColor: string;
  searchedClassType?: string;
  isBookmarked?: boolean;
  scheduledLabels?: string[];
  onBookmark?: (data: FitnessStudioCardData) => void;
  onScheduleClass?: (studio: FitnessStudioCardData, cls: StudioClass) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  yoga: '🧘',
  pilates: '🤸',
  hiit: '🔥',
  spinning: '🚴',
  barre: '🩰',
  boxing: '🥊',
  strength: '🏋️',
  dance: '💃',
  stretch: '🙆',
  meditation: '🧘‍♀️',
  cardio: '❤️‍🔥',
  bootcamp: '⚡',
  crossfit: '💪',
};

function getCategoryIcon(category?: string): string {
  if (!category) return '💪';
  return CATEGORY_ICONS[category.toLowerCase()] || '💪';
}

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.3;
  const stars = [];

  for (let i = 0; i < 5; i++) {
    if (i < full) {
      stars.push(<Star key={i} size={12} fill="currentColor" className="text-yellow-400" />);
    } else if (i === full && hasHalf) {
      stars.push(<Star key={i} size={12} fill="currentColor" className="text-yellow-400 opacity-50" />);
    } else {
      stars.push(<Star key={i} size={12} className="text-yellow-400 opacity-25" />);
    }
  }

  return <div className="flex items-center gap-px">{stars}</div>;
}

// ── Component ───────────────────────────────────────────────────────────

export function FitnessStudioCard({
  data,
  agentColor,
  searchedClassType,
  isBookmarked = false,
  scheduledLabels = [],
  onBookmark,
  onScheduleClass,
}: FitnessStudioCardProps) {
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const hasClasses = data.todayClasses.length > 0;

  return (
    <div
      className="rounded-xl overflow-hidden border transition-all"
      style={{
        borderColor: 'var(--bg-surface-elevated)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      {/* ── Photo header ─────────────────────────────────────────── */}
      {data.photoUrl ? (
        <div className="relative h-32 w-full overflow-hidden">
          <img
            src={data.photoUrl}
            alt={data.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)',
            }}
          />
          {data.openNow !== null && (
            <div className="absolute top-2 right-2">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: data.openNow ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
                  color: 'white',
                }}
              >
                {data.openNow ? 'Open' : 'Closed'}
              </span>
            </div>
          )}
          <div className="absolute bottom-2 left-3 right-3">
            <h3 className="font-bold text-white text-base leading-tight drop-shadow-md">
              {data.name}
            </h3>
          </div>
        </div>
      ) : (
        <div
          className="px-3 py-3 flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${agentColor}22, ${agentColor}08)` }}
        >
          <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
            {data.name}
          </h3>
          {data.openNow !== null && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{
                backgroundColor: data.openNow ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: data.openNow ? '#22c55e' : '#ef4444',
              }}
            >
              <Clock size={10} />
              {data.openNow ? 'Open' : 'Closed'}
            </span>
          )}
        </div>
      )}

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="p-3 space-y-2.5">
        {/* Rating row */}
        {data.rating && (
          <div className="flex items-center gap-2 flex-wrap">
            <RatingStars rating={data.rating} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {data.rating.toFixed(1)}
            </span>
            {data.reviewCount && (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                ({data.reviewCount.toLocaleString()})
              </span>
            )}
          </div>
        )}

        {/* Editorial summary */}
        {data.editorialSummary && (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {data.editorialSummary}
          </p>
        )}

        {/* Type tags */}
        {data.types.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {data.types.map((type) => (
              <span
                key={type}
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${agentColor}12`, color: agentColor }}
              >
                {type}
              </span>
            ))}
          </div>
        )}

        {/* Address */}
        <div className="flex items-start gap-1.5">
          <MapPin size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginTop: 2 }} />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {data.address}
          </span>
        </div>

        {/* ── Today's Classes Section ────────────────────────────── */}
        <div
          className="rounded-lg overflow-hidden border"
          style={{ borderColor: 'var(--bg-surface-elevated)' }}
        >
          {/* Section header */}
          <div
            className="px-3 py-2 flex items-center justify-between"
            style={{ backgroundColor: `${agentColor}10` }}
          >
            <div className="flex items-center gap-2">
              <Dumbbell size={13} style={{ color: agentColor }} />
              <span className="text-xs font-semibold" style={{ color: agentColor }}>
                Today's Classes
              </span>
            </div>
            <div className="flex items-center gap-2">
              {data.scheduleSource === 'mindbody' && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
                >
                  Live
                </span>
              )}
              <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                {todayLabel}
              </span>
            </div>
          </div>

          {/* Class list */}
          {hasClasses ? (
            <div className="divide-y" style={{ borderColor: 'var(--bg-surface-elevated)' }}>
              {data.todayClasses.map((cls, i) => {
                const isMatch = searchedClassType &&
                  cls.category?.toLowerCase() === searchedClassType.toLowerCase();

                return (
                  <div
                    key={`${cls.time}-${cls.name}-${i}`}
                    className="px-3 py-2 flex items-center gap-3 transition-colors"
                    style={{
                      backgroundColor: isMatch ? `${agentColor}08` : 'transparent',
                    }}
                  >
                    {/* Time column */}
                    <div className="flex-shrink-0 w-16 text-right">
                      <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {cls.time}
                      </div>
                      {cls.endTime && (
                        <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                          {cls.endTime}
                        </div>
                      )}
                    </div>

                    {/* Divider dot */}
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: isMatch ? agentColor : 'var(--text-secondary)' }}
                    />

                    {/* Class details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{getCategoryIcon(cls.category)}</span>
                        <span
                          className="text-xs font-medium truncate"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {cls.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {cls.instructor && (
                          <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                            <User size={9} />
                            {cls.instructor}
                          </span>
                        )}
                        {cls.duration && (
                          <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                            {cls.duration}
                          </span>
                        )}
                        {cls.level && (
                          <span
                            className="text-[10px] px-1 py-px rounded"
                            style={{
                              backgroundColor: 'var(--bg-surface-elevated)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {cls.level}
                          </span>
                        )}
                        {cls.spotsRemaining != null && (
                          <span
                            className="text-[10px] font-medium"
                            style={{
                              color: cls.spotsRemaining === 0
                                ? 'var(--error, #ef4444)'
                                : cls.spotsRemaining <= 5
                                  ? 'var(--warning, #f59e0b)'
                                  : 'var(--success, #22c55e)',
                            }}
                          >
                            {cls.spotsRemaining === 0 ? 'Full' : `${cls.spotsRemaining} spots`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Add to schedule button */}
                    {onScheduleClass && (() => {
                      const classLabel = `${cls.name} — ${cls.time} (${data.name})`;
                      const scheduled = scheduledLabels.includes(classLabel);
                      return (
                        <button
                          onClick={() => onScheduleClass(data, cls)}
                          className="flex-shrink-0 p-1.5 rounded-full transition-colors hover:opacity-80"
                          style={{ backgroundColor: scheduled ? agentColor : `${agentColor}15` }}
                          title={scheduled ? 'Remove from schedule' : 'Add to schedule'}
                        >
                          {scheduled
                            ? <Check size={12} style={{ color: 'white' }} />
                            : <CalendarPlus size={12} style={{ color: agentColor }} />
                          }
                        </button>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-4 text-center">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {data.scheduleSource === 'unavailable'
                  ? 'Schedule not available online'
                  : 'No classes listed for today'}
              </p>
              {data.website && (
                <a
                  href={data.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs mt-1 hover:underline"
                  style={{ color: agentColor }}
                >
                  <Globe size={10} />
                  Check their website
                </a>
              )}
            </div>
          )}
        </div>

        {/* Contact links */}
        <div className="flex items-center gap-3 flex-wrap">
          {data.phone && (
            <a
              href={`tel:${data.phone}`}
              className="flex items-center gap-1 text-xs hover:underline"
              style={{ color: agentColor }}
            >
              <Phone size={12} />
              {data.phone}
            </a>
          )}
          {data.website && (
            <a
              href={data.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs hover:underline"
              style={{ color: agentColor }}
            >
              <Globe size={12} />
              Website
            </a>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          {data.website && (
            <a
              href={data.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: agentColor, color: 'white' }}
            >
              <ExternalLink size={13} />
              Book
            </a>
          )}
          {data.googleMapsUrl && (
            <a
              href={data.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-opacity hover:opacity-90"
              style={{ borderColor: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}
            >
              <MapPin size={13} />
              Directions
            </a>
          )}
          {onBookmark && (
            <button
              onClick={() => onBookmark(data)}
              className="p-2 rounded-lg transition-colors"
              style={{
                backgroundColor: isBookmarked ? `${agentColor}20` : 'var(--bg-surface-elevated)',
              }}
              title={isBookmarked ? 'Saved' : 'Save studio'}
            >
              {isBookmarked
                ? <BookmarkCheck size={14} style={{ color: agentColor }} />
                : <Bookmark size={14} style={{ color: 'var(--text-secondary)' }} />
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
