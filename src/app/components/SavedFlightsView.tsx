import { useState } from 'react';
import {
  Plane, Clock, Trash2, ExternalLink, ChevronDown, ChevronUp,
  Bookmark, Dumbbell, MapPin, Globe, Star,
} from 'lucide-react';
import { useTravelStore, TravelBookmark } from '../../stores/travel';
import { useFitnessStore, FitnessBookmark } from '../../stores/fitness';

// ── Helpers ─────────────────────────────────────────────────────────────

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

type TabId = 'flights' | 'fitness';

// ══════════════════════════════════════════════════════════════════════════
// FLIGHT BOOKMARKS (existing)
// ══════════════════════════════════════════════════════════════════════════

function groupFlightsByMonth(bookmarks: TravelBookmark[]): { label: string; items: TravelBookmark[] }[] {
  const flightBookmarks = bookmarks
    .filter((b) => b.type === 'flight' && b.data?.departureDate)
    .sort((a, b) => (a.data.departureDate || '').localeCompare(b.data.departureDate || ''));

  const undated = bookmarks.filter((b) => b.type === 'flight' && !b.data?.departureDate);
  const groups = new Map<string, TravelBookmark[]>();

  for (const bk of flightBookmarks) {
    const d = new Date(bk.data.departureDate + 'T00:00:00');
    const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(bk);
  }

  const result = Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
  if (undated.length > 0) result.push({ label: 'No date set', items: undated });
  return result;
}

function SavedFlightCard({ bookmark, onRemove }: { bookmark: TravelBookmark; onRemove: (id: string) => void }) {
  const d = bookmark.data;
  const agentColor = 'var(--accent-travel)';

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border transition-all hover:border-opacity-60"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-surface-elevated)' }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
      >
        <Plane size={18} style={{ color: agentColor }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {d.airline || 'Flight'}
          </span>
          {d.flightNumber && (
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
              {d.flightNumber}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>{d.departure?.city || '?'}</span>
          <span style={{ color: agentColor }}>→</span>
          <span>{d.arrival?.city || '?'}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {d.departureDate && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {formatDateLabel(d.departureDate)}
            </span>
          )}
          {d.departure?.time && (
            <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--text-secondary)' }}>
              <Clock size={10} />
              {d.departure.time}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {d.price && (
          <span className="font-semibold text-sm" style={{ color: agentColor }}>
            {d.price}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          {d.bookingUrl && (
            <a
              href={d.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
              title="Book flight"
            >
              <ExternalLink size={14} style={{ color: agentColor }} />
            </a>
          )}
          <button
            onClick={() => onRemove(bookmark.id)}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
            title="Remove"
          >
            <Trash2 size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MonthGroup({
  label,
  items,
  onRemove,
  defaultOpen,
}: {
  label: string;
  items: TravelBookmark[];
  onRemove: (id: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-2 px-1 group"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-secondary)' }}
          >
            {items.length}
          </span>
        </div>
        {open ? (
          <ChevronUp size={16} style={{ color: 'var(--text-secondary)' }} />
        ) : (
          <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
        )}
      </button>
      {open && (
        <div className="space-y-2 pb-4">
          {items.map((bk) => (
            <SavedFlightCard key={bk.id} bookmark={bk} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// FITNESS BOOKMARKS (new)
// ══════════════════════════════════════════════════════════════════════════

function SavedStudioCard({
  bookmark,
  onRemove,
}: {
  bookmark: FitnessBookmark;
  onRemove: (id: string) => void;
}) {
  const d = bookmark.data;
  const agentColor = 'var(--accent-fitness)';

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border transition-all hover:border-opacity-60"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-surface-elevated)' }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
      >
        <Dumbbell size={18} style={{ color: agentColor }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {d.name || bookmark.label || 'Studio'}
          </span>
          {d.rating && (
            <span className="flex items-center gap-0.5 text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
              <Star size={10} fill="currentColor" className="text-yellow-400" />
              {d.rating}
            </span>
          )}
        </div>
        {d.address && (
          <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            <MapPin size={10} />
            <span className="truncate">{d.address}</span>
          </div>
        )}
        {d.todayClasses?.length > 0 && (
          <div className="text-xs mt-0.5" style={{ color: agentColor }}>
            {d.todayClasses.length} class{d.todayClasses.length !== 1 ? 'es' : ''} today
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {d.website && (
          <a
            href={d.website}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
            title="Book classes"
          >
            <ExternalLink size={14} style={{ color: agentColor }} />
          </a>
        )}
        {d.googleMapsUrl && (
          <a
            href={d.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
            title="Get directions"
          >
            <Globe size={14} style={{ color: 'var(--text-secondary)' }} />
          </a>
        )}
        <button
          onClick={() => onRemove(bookmark.id)}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
          title="Remove"
        >
          <Trash2 size={14} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN SAVED VIEW
// ══════════════════════════════════════════════════════════════════════════

export function SavedFlightsView() {
  const travelBookmarks = useTravelStore((s) => s.profile.bookmarks);
  const removeTravelBookmark = useTravelStore((s) => s.removeBookmark);
  const fitnessBookmarks = useFitnessStore((s) => s.profile.bookmarks);
  const removeFitnessBookmark = useFitnessStore((s) => s.removeBookmark);

  const flightCount = travelBookmarks.filter((b) => b.type === 'flight').length;
  const studioCount = fitnessBookmarks.length;
  const totalCount = flightCount + studioCount;

  const [activeTab, setActiveTab] = useState<TabId>(flightCount > 0 ? 'flights' : 'fitness');

  const tabs: { id: TabId; label: string; count: number; color: string; icon: typeof Plane }[] = [
    { id: 'flights', label: 'Flights', count: flightCount, color: 'var(--accent-travel)', icon: Plane },
    { id: 'fitness', label: 'Studios', count: studioCount, color: 'var(--accent-fitness)', icon: Dumbbell },
  ];

  const flightGroups = groupFlightsByMonth(travelBookmarks);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="h-14 flex items-center justify-between px-4 border-b flex-shrink-0"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-surface-elevated)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--accent-travel)20' }}
          >
            <Bookmark size={16} style={{ color: 'var(--accent-travel)' }} />
          </div>
          <div>
            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>Saved</div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {totalCount} item{totalCount !== 1 ? 's' : ''} saved
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex border-b px-4 gap-1"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-surface-elevated)' }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2"
              style={{
                borderColor: isActive ? tab.color : 'transparent',
                color: isActive ? tab.color : 'var(--text-secondary)',
              }}
            >
              <tab.icon size={13} />
              {tab.label}
              {tab.count > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{
                    backgroundColor: isActive ? `${tab.color}20` : 'var(--bg-surface-elevated)',
                    color: isActive ? tab.color : 'var(--text-secondary)',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 pb-20 sm:pb-4"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {/* Flights tab */}
        {activeTab === 'flights' && (
          <>
            {flightCount === 0 ? (
              <EmptyState
                icon={Plane}
                title="No saved flights yet"
                description="Search for flights in the Travel tab and tap Save to bookmark them here."
              />
            ) : (
              <div className="max-w-2xl mx-auto space-y-1">
                {flightGroups.map((group, idx) => (
                  <MonthGroup
                    key={group.label}
                    label={group.label}
                    items={group.items}
                    onRemove={removeTravelBookmark}
                    defaultOpen={idx < 3}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Fitness tab */}
        {activeTab === 'fitness' && (
          <>
            {studioCount === 0 ? (
              <EmptyState
                icon={Dumbbell}
                title="No saved studios yet"
                description="Search for fitness classes in the Fitness tab and tap Save to bookmark studios here."
              />
            ) : (
              <div className="max-w-2xl mx-auto space-y-2">
                {fitnessBookmarks.map((bk) => (
                  <SavedStudioCard key={bk.id} bookmark={bk} onRemove={removeFitnessBookmark} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Plane;
  title: string;
  description: string;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <Icon size={28} style={{ color: 'var(--text-secondary)' }} />
      </div>
      <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
        {description}
      </p>
    </div>
  );
}
