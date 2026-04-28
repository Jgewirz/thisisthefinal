import { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { useWardrobeStore } from '../../stores/wardrobe';
import {
  WARDROBE_CATEGORIES,
  type WardrobeCategory,
  type WardrobeSeason,
  type WardrobeWarmth,
} from '../../lib/wardrobeApi';

const SEASONS: readonly WardrobeSeason[] = ['spring', 'summer', 'fall', 'winter'];
const WARMTHS: readonly WardrobeWarmth[] = ['light', 'medium', 'heavy'];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export interface AddWardrobeDialogProps {
  onClose: () => void;
  /** Called on success (receives the created item id). */
  onSaved?: (id: string) => void;
  /** Prefill the image from an existing photo (e.g. chat message). */
  imageUrl?: string | null;
  /** Stable key so idempotent create dedupes across retries (e.g. message id). */
  clientId?: string;
  /** Override the default category dropdown value. */
  defaultCategory?: WardrobeCategory;
}

/**
 * Shared "add wardrobe item" dialog. Used from both the wardrobe screen and
 * from photo messages in chat (Save to wardrobe). When `imageUrl` is given,
 * the item is persisted with that URL so the wardrobe thumbnail matches the
 * photo the user uploaded.
 */
export function AddWardrobeDialog({
  onClose,
  onSaved,
  imageUrl,
  clientId,
  defaultCategory = 'top',
}: AddWardrobeDialogProps) {
  const add = useWardrobeStore((s) => s.add);

  const [category, setCategory] = useState<WardrobeCategory>(defaultCategory);
  const [color, setColor] = useState('');
  const [subtype, setSubtype] = useState('');
  const [warmth, setWarmth] = useState<WardrobeWarmth | ''>('');
  const [seasons, setSeasons] = useState<WardrobeSeason[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(imageUrl ?? null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggleSeason = (s: WardrobeSeason) => {
    setSeasons((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const onPickPhoto = (file: File | null) => {
    setPhotoError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please pick an image file.');
      return;
    }
    // Base64 data URLs expand size; keep a conservative cap client-side.
    if (file.size > MAX_UPLOAD_BYTES) {
      setPhotoError('That photo is too large. Please pick a smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setPhotoError('Could not read that photo. Please try a different file.');
    reader.onload = () => {
      const out = typeof reader.result === 'string' ? reader.result : null;
      if (!out) {
        setPhotoError('Could not read that photo. Please try a different file.');
        return;
      }
      setPhotoUrl(out);
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const out = await add(
        {
          category,
          color: color.trim() || null,
          subtype: subtype.trim() || null,
          warmth: warmth || null,
          seasons,
          imageUrl: photoUrl ?? null,
        },
        clientId,
      );
      if (out) {
        onSaved?.(out.id);
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add wardrobe item"
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Add item
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-[var(--bg-surface-elevated)]"
          >
            <X size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <Field label="Photo">
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onPickPhoto(e.currentTarget.files?.[0] ?? null)}
              className="w-full text-xs"
              aria-label="Upload photo"
              disabled={submitting}
            />
            {photoError && (
              <div className="text-xs" style={{ color: '#f87171' }} role="alert">
                {photoError}
              </div>
            )}
            {photoUrl && (
              <div className="space-y-2">
                <div
                  className="rounded-lg overflow-hidden flex items-center justify-center"
                  style={{ backgroundColor: 'var(--bg-surface-elevated)', maxHeight: 200 }}
                >
                  <img src={photoUrl} alt="" className="w-full h-full object-cover max-h-48" />
                </div>
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="text-xs underline"
                  style={{ color: 'var(--text-secondary)' }}
                  disabled={submitting}
                >
                  Remove photo
                </button>
              </div>
            )}
          </div>
        </Field>

        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as WardrobeCategory)}
            className="w-full px-3 py-2 rounded-lg text-sm capitalize"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              color: 'var(--text-primary)',
            }}
          >
            {WARDROBE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Color">
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="e.g. black"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
              }}
            />
          </Field>
          <Field label="Subtype">
            <input
              type="text"
              value={subtype}
              onChange={(e) => setSubtype(e.target.value)}
              placeholder="e.g. tshirt"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
              }}
            />
          </Field>
        </div>

        <Field label="Warmth">
          <div className="flex gap-2">
            {WARMTHS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWarmth(warmth === w ? '' : w)}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs capitalize"
                style={{
                  backgroundColor:
                    warmth === w ? 'var(--accent-style)' : 'var(--bg-surface-elevated)',
                  color: warmth === w ? 'var(--bg-primary)' : 'var(--text-secondary)',
                }}
              >
                {w}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Seasons">
          <div className="flex gap-2 flex-wrap">
            {SEASONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSeason(s)}
                aria-pressed={seasons.includes(s)}
                className="px-3 py-1.5 rounded-full text-xs capitalize"
                style={{
                  backgroundColor: seasons.includes(s)
                    ? 'var(--accent-style)'
                    : 'var(--bg-surface-elevated)',
                  color: seasons.includes(s) ? 'var(--bg-primary)' : 'var(--text-secondary)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--accent-style)', color: 'var(--bg-primary)' }}
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Save item
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}
