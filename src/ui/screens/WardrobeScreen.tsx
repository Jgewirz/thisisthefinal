import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Plus, Sparkles, Shirt, Loader2 } from 'lucide-react';
import { useWardrobeStore } from '../../stores/wardrobe';
import {
  WARDROBE_CATEGORIES,
  type WardrobeCategory,
  type WardrobeItem,
} from '../../core/wardrobe';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EditWardrobeDialog } from '../components/EditWardrobeDialog';
import { ReviewWardrobeDialog } from '../components/ReviewWardrobeDialog';
import { WardrobeCard } from '../components/WardrobeCard';

export function WardrobeScreen() {
  const byId = useWardrobeStore((s) => s.byId);
  const loaded = useWardrobeStore((s) => s.loaded);
  const loading = useWardrobeStore((s) => s.loading);
  const error = useWardrobeStore((s) => s.error);
  const load = useWardrobeStore((s) => s.load);
  const remove = useWardrobeStore((s) => s.remove);

  const [category, setCategory] = useState<WardrobeCategory | 'all'>('all');
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<WardrobeItem | null>(null);
  const [editing, setEditing] = useState<WardrobeItem | null>(null);

  useEffect(() => {
    if (!loaded && !loading) void load();
  }, [loaded, loading, load]);

  const items = useMemo(() => {
    const all = Object.values(byId).sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1
    );
    return category === 'all' ? all : all.filter((it) => it.category === category);
  }, [byId, category]);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <WardrobeHeader onAdd={() => setAdding(true)} />

      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--bg-surface-elevated)' }}>
        <CategoryFilter value={category} onChange={setCategory} />
      </div>

      {error && (
        <div
          className="px-4 py-2 text-xs"
          style={{ color: '#f87171', backgroundColor: 'rgba(248, 113, 113, 0.08)' }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20 sm:pb-4">
        {loading && !loaded ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--text-secondary)' }} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState category={category} onAdd={() => setAdding(true)} />
        ) : (
          <ul
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
            aria-label="Wardrobe items"
          >
            {items.map((it) => (
              <WardrobeCard
                key={it.id}
                item={it}
                onOpen={() => setEditing(it)}
                onDelete={() => setConfirmRemove(it)}
              />
            ))}
          </ul>
        )}
      </div>

      {adding && (
        <ReviewWardrobeDialog
          onClose={() => setAdding(false)}
          defaultCategory={category === 'all' ? 'top' : category}
        />
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Remove this item?"
          detail="This will permanently remove the photo and its tags from your wardrobe."
          confirmText="Yes, remove"
          cancelText="No, keep"
          destructive
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => {
            const id = confirmRemove.id;
            setConfirmRemove(null);
            void remove(id);
          }}
        />
      )}

      {editing && <EditWardrobeDialog item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function WardrobeHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      className="h-14 flex items-center justify-between px-4 border-b"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-surface-elevated)',
      }}
    >
      <div className="flex items-center gap-3">
        <Link
          to="/style"
          className="p-2 rounded-lg hover:bg-[var(--bg-surface-elevated)] active:scale-90 transition-all"
          aria-label="Back to Style agent"
        >
          <ArrowLeft size={20} style={{ color: 'var(--text-secondary)' }} />
        </Link>
        <div className="flex items-center gap-2">
          <Shirt size={20} style={{ color: 'var(--accent-style)' }} />
          <h1 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Wardrobe
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to="/outfits/build"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[var(--bg-surface-elevated)] transition-all"
          style={{ color: 'var(--accent-style)' }}
          aria-label="Open outfit builder"
        >
          <Sparkles size={16} />
          Build outfit
        </Link>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:brightness-110 active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--accent-style)', color: 'var(--bg-primary)' }}
        >
          <Plus size={16} />
          Add
        </button>
      </div>
    </div>
  );
}

function CategoryFilter({
  value,
  onChange,
}: {
  value: WardrobeCategory | 'all';
  onChange: (v: WardrobeCategory | 'all') => void;
}) {
  const options: Array<WardrobeCategory | 'all'> = ['all', ...WARDROBE_CATEGORIES];
  return (
    <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Filter by category">
      {options.map((c) => {
        const active = c === value;
        return (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(c)}
            className="px-3 py-1 rounded-full text-xs capitalize whitespace-nowrap transition-all"
            style={{
              backgroundColor: active ? 'var(--accent-style)' : 'var(--bg-surface)',
              color: active ? 'var(--bg-primary)' : 'var(--text-secondary)',
            }}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({
  category,
  onAdd,
}: {
  category: WardrobeCategory | 'all';
  onAdd: () => void;
}) {
  return (
    <div className="text-center py-12">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <Shirt size={24} style={{ color: 'var(--text-secondary)' }} />
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
        {category === 'all'
          ? 'No items in your wardrobe yet.'
          : `No ${category} items yet.`}
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
        style={{ backgroundColor: 'var(--accent-style)', color: 'var(--bg-primary)' }}
      >
        <Plus size={16} />
        Add your first item
      </button>
    </div>
  );
}

// WardrobeCard extracted to its own file so its Ready/Draft affordance is testable.
