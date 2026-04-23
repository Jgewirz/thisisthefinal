import { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Save, X } from 'lucide-react';
import { useWardrobeStore } from '../../stores/wardrobe';
import {
  WARDROBE_CATEGORIES,
  type WardrobeCategory,
  type WardrobeItem,
  type WardrobeSeason,
  type WardrobeWarmth,
} from '../../lib/wardrobeApi';
import { isVerifiedItem, verifiedAttributesPatch } from '../../lib/wardrobeVerification';

const SEASONS: readonly WardrobeSeason[] = ['spring', 'summer', 'fall', 'winter'];
const WARMTHS: readonly WardrobeWarmth[] = ['light', 'medium', 'heavy'];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export interface EditWardrobeDialogProps {
  item: WardrobeItem;
  onClose: () => void;
}

export function EditWardrobeDialog({ item, onClose }: EditWardrobeDialogProps) {
  const patch = useWardrobeStore((s) => s.patch);

  const initialVerified = useMemo(() => isVerifiedItem(item), [item]);
  const [category, setCategory] = useState<WardrobeCategory>(item.category);
  const [color, setColor] = useState(item.color ?? '');
  const [subtype, setSubtype] = useState(item.subtype ?? '');
  const [warmth, setWarmth] = useState<WardrobeWarmth | ''>(item.warmth ?? '');
  const [seasons, setSeasons] = useState<WardrobeSeason[]>(item.seasons ?? []);
  const [photoUrl, setPhotoUrl] = useState<string | null>(item.image_url ?? null);

  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

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

  const saveChanges = async () => {
    if (saving) return;
    setSaving(true);
    setVerifyError(null);
    try {
      await patch(item.id, {
        category,
        color: color.trim() || null,
        subtype: subtype.trim() || null,
        warmth: warmth || null,
        seasons,
        imageUrl: photoUrl ?? null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const markReady = async () => {
    if (saving) return;
    setVerifyError(null);
    if (!photoUrl || !photoUrl.trim()) {
      setVerifyError('Add a photo first — strict outfit mode requires a photo-backed item.');
      return;
    }
    setSaving(true);
    try {
      await patch(item.id, {
        imageUrl: photoUrl,
        attributes: verifiedAttributesPatch(item.attributes),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Edit wardrobe item"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              Item details
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Status: {initialVerified ? 'Ready for outfits' : 'Draft'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-[var(--bg-surface-elevated)]"
            disabled={saving}
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
              disabled={saving}
            />
            {photoError && (
              <div className="text-xs" style={{ color: '#f87171' }} role="alert">
                {photoError}
              </div>
            )}
            {photoUrl ? (
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
                  disabled={saving}
                >
                  Remove photo
                </button>
              </div>
            ) : (
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                No photo yet. You need a photo to mark an item “Ready for outfits”.
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
            disabled={saving}
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
              disabled={saving}
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
              disabled={saving}
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
                  opacity: saving ? 0.6 : 1,
                }}
                disabled={saving}
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
                  opacity: saving ? 0.6 : 1,
                }}
                disabled={saving}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        {verifyError && (
          <div className="text-xs" style={{ color: '#f87171' }} role="alert">
            {verifyError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={saveChanges}
            disabled={saving}
            className="w-full py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--bg-surface-elevated)', color: 'var(--text-primary)' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
          <button
            type="button"
            onClick={markReady}
            disabled={saving}
            className="w-full py-2.5 rounded-lg font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--accent-style)', color: 'var(--bg-primary)' }}
            aria-label="Mark ready for outfits"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Mark Ready
          </button>
        </div>
      </div>
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

