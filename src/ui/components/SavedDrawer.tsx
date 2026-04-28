import { Bookmark, ExternalLink, Plane, Hotel, MapPin, Dumbbell, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSavedStore } from '../../stores/saved';
import type { SavedItemKind, SavedItem } from '../../lib/savedApi';

const KIND_META: Record<
  Exclude<SavedItemKind, 'reminder'>,
  { label: string; Icon: typeof Plane }
> = {
  hotel: { label: 'Hotels', Icon: Hotel },
  flight: { label: 'Flights', Icon: Plane },
  place: { label: 'Places', Icon: MapPin },
  studio: { label: 'Studios', Icon: Dumbbell },
};

const ORDER: (keyof typeof KIND_META)[] = ['hotel', 'flight', 'studio', 'place'];

/**
 * Decide what link to open when the user taps a saved row. Falls back to a
 * Google Maps search when the card has no direct link (e.g. a place with
 * only name + address).
 */
export function savedItemHref(it: SavedItem): string {
  const d = it.data as Record<string, unknown>;
  const direct =
    (typeof d.bookingUrl === 'string' && d.bookingUrl) ||
    (typeof d.websiteUri === 'string' && d.websiteUri) ||
    (typeof d.googleMapsUri === 'string' && d.googleMapsUri);
  if (direct) return direct;
  const name = typeof d.name === 'string' ? d.name : '';
  const address = typeof d.address === 'string' ? d.address : '';
  const q = encodeURIComponent(`${name} ${address}`.trim() || it.external_id);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Human-friendly summary for a saved row. */
export function savedItemTitle(it: SavedItem): string {
  const d = it.data as Record<string, unknown>;
  if (typeof d.name === 'string' && d.name.length > 0) return d.name;
  if (it.kind === 'flight') {
    const price = typeof d.priceTotal === 'string' ? d.priceTotal : '';
    const cur = typeof d.currency === 'string' ? d.currency : '';
    return `Flight ${price} ${cur}`.trim() || `Flight ${it.external_id}`;
  }
  return `${it.kind} ${it.external_id}`;
}

interface SavedDrawerProps {
  open: boolean;
  onClose: () => void;
  agentColor: string;
}

export function SavedDrawer({ open, onClose, agentColor }: SavedDrawerProps) {
  const byKey = useSavedStore((s) => s.byKey);
  const loadKind = useSavedStore((s) => s.loadKind);
  const unsave = useSavedStore((s) => s.unsave);

  useEffect(() => {
    if (!open) return;
    for (const kind of ORDER) void loadKind(kind);
  }, [open, loadKind]);

  const grouped = useMemo(() => {
    const out: Record<string, SavedItem[]> = { hotel: [], flight: [], place: [], studio: [] };
    for (const it of Object.values(byKey)) {
      if (out[it.kind]) out[it.kind].push(it);
    }
    for (const key of Object.keys(out)) {
      out[key].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return out;
  }, [byKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-label="Saved items">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="relative ml-auto h-full w-full max-w-md p-4 overflow-y-auto shadow-xl"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bookmark size={18} style={{ color: agentColor }} />
            <h2
              className="text-base font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              Saved
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close saved items"
            className="p-2 rounded-lg hover:bg-[var(--bg-surface-elevated)] focus:outline-none focus-visible:ring-2"
          >
            <X size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {ORDER.every((k) => grouped[k].length === 0) ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Nothing saved yet. Tap the star on any flight, hotel, studio, or place to save it
            here for later.
          </p>
        ) : (
          ORDER.map((kind) => {
            const items = grouped[kind];
            if (items.length === 0) return null;
            const { label, Icon } = KIND_META[kind];
            return (
              <section key={kind} className="mb-5" aria-label={label}>
                <div
                  className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wide"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Icon size={12} />
                  <span>{label}</span>
                  <span aria-hidden="true">·</span>
                  <span>{items.length}</span>
                </div>
                <ul className="space-y-2">
                  {items.map((it) => (
                    <SavedRow
                      key={`${it.kind}:${it.external_id}`}
                      item={it}
                      agentColor={agentColor}
                      onRemove={() => void unsave(it.kind, it.external_id)}
                    />
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </aside>
    </div>
  );
}

function SavedRow({
  item,
  agentColor,
  onRemove,
}: {
  item: SavedItem;
  agentColor: string;
  onRemove: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const href = savedItemHref(item);
  const title = savedItemTitle(item);
  return (
    <li
      className="relative p-3 rounded-lg"
      style={{ backgroundColor: 'var(--bg-surface-elevated, rgba(0,0,0,0.04))' }}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block pr-8 hover:opacity-90"
      >
        <div
          className="font-medium text-sm truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </div>
        {typeof (item.data as any)?.address === 'string' && (
          <div
            className="text-xs truncate"
            style={{ color: 'var(--text-secondary)' }}
          >
            {String((item.data as any).address)}
          </div>
        )}
        <div
          className="mt-1 inline-flex items-center gap-1 text-[10px]"
          style={{ color: agentColor }}
        >
          <ExternalLink size={10} /> Open
        </div>
      </a>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (removing) return;
          setRemoving(true);
          onRemove();
        }}
        disabled={removing}
        aria-label={`Remove ${title} from saved`}
        title="Remove"
        className="absolute top-2 right-2 p-1 rounded-full hover:opacity-80 focus:outline-none focus-visible:ring-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        <X size={14} />
      </button>
    </li>
  );
}
