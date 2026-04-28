import { Shirt, Trash2 } from 'lucide-react';
import type { WardrobeItem } from '../../lib/wardrobeApi';
import { verificationStatus } from '../../lib/wardrobeVerification';

export function WardrobeCard({
  item,
  onOpen,
  onDelete,
}: {
  item: WardrobeItem;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const tagLine = [item.color, item.subtype].filter(Boolean).join(' · ');
  const status = verificationStatus(item);

  return (
    <li
      className="rounded-lg overflow-hidden flex flex-col"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${item.category}`}
        className="text-left"
      >
        <div
          className="aspect-square flex items-center justify-center relative"
          style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
        >
          <span
            className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full leading-tight"
            style={
              status === 'verified'
                ? {
                    backgroundColor: '#16a34a',
                    color: '#f0fdf4',
                  }
                : {
                    backgroundColor: '#3b3853',
                    color: '#c4bdd0',
                  }
            }
            aria-label={status === 'verified' ? 'Ready for outfits' : 'Draft item'}
          >
            {status === 'verified' ? '✓ Ready' : 'Draft'}
          </span>

          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.subtype ?? item.category}
              className="w-full h-full object-cover"
            />
          ) : (
            <Shirt size={32} style={{ color: 'var(--text-secondary)' }} />
          )}
        </div>
        <div className="p-2 flex-1 flex flex-col gap-1">
          <div className="text-xs capitalize" style={{ color: 'var(--text-primary)' }}>
            {item.category}
          </div>
          {tagLine && (
            <div className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>
              {tagLine}
            </div>
          )}
          <div className="flex flex-wrap gap-1 mt-auto pt-1">
            {item.seasons.slice(0, 2).map((s) => (
              <span
                key={s}
                className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  color: 'var(--text-secondary)',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label={`Delete ${item.category}`}
        className="p-2 text-xs flex items-center justify-center gap-1 hover:bg-[var(--bg-surface-elevated)] transition-all border-t"
        style={{ color: 'var(--text-secondary)', borderColor: 'var(--bg-surface-elevated)' }}
      >
        <Trash2 size={14} />
        Remove
      </button>
    </li>
  );
}
