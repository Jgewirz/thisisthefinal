import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Save, Sparkles, X } from 'lucide-react';
import { useWardrobeStore } from '../../stores/wardrobe';
import {
  WARDROBE_CATEGORIES,
  analyzeClothingPhoto,
  type WardrobeCategory,
  type WardrobeSeason,
  type WardrobeWarmth,
} from '../../lib/wardrobeApi';
import {
  suggestFromClothingAnalysis,
  suggestionToPayload,
  type WardrobeSuggestion,
} from '../../lib/wardrobeSuggestions';

const SEASONS: readonly WardrobeSeason[] = ['spring', 'summer', 'fall', 'winter'];
const WARMTHS: readonly WardrobeWarmth[] = ['light', 'medium', 'heavy'];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export interface ReviewWardrobeDialogProps {
  onClose: () => void;
  onSaved?: (id: string) => void;
  /** Prefill the photo from an external source (e.g. chat message). */
  imageUrl?: string | null;
  /** Stable idempotency key so retries don't duplicate. */
  clientId?: string;
  defaultCategory?: WardrobeCategory;
}

type AnalysisState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done' }
  | { status: 'failed' };

/**
 * Photo-first Review & Confirm flow.
 *
 * 1. User picks a photo (or starts with one prefilled).
 * 2. `/api/style/analyze?type=clothing_tag` auto-runs → prefills the form.
 * 3. User edits tags.
 * 4. Two actions:
 *    - "Save as Draft"  → verified=false (not usable in strict outfits)
 *    - "Mark Ready"     → verified=true  (eligible for strict outfits)
 */
export function ReviewWardrobeDialog({
  onClose,
  onSaved,
  imageUrl: initialImage,
  clientId,
  defaultCategory = 'top',
}: ReviewWardrobeDialogProps) {
  const add = useWardrobeStore((s) => s.add);

  const [photoUrl, setPhotoUrl] = useState<string | null>(initialImage ?? null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [suggestion, setSuggestion] = useState<WardrobeSuggestion>(() => ({
    category: defaultCategory,
    subtype: null,
    color: null,
    colorHex: null,
    seasons: [],
    warmth: null,
    occasions: [],
  }));

  const [analysis, setAnalysis] = useState<AnalysisState>({ status: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Auto-analyze whenever a new photo is set (only once per photo).
  const lastAnalyzedPhotoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!photoUrl) return;
    if (lastAnalyzedPhotoRef.current === photoUrl) return;
    lastAnalyzedPhotoRef.current = photoUrl;

    let cancelled = false;
    setAnalysis({ status: 'running' });

    (async () => {
      const result = await analyzeClothingPhoto(photoUrl);
      if (cancelled) return;
      if (result) {
        const next = suggestFromClothingAnalysis(result);
        setSuggestion((prev) => ({
          // Preserve any user-edited fields the model didn't provide.
          ...prev,
          category: next.category,
          color: next.color ?? prev.color,
          colorHex: next.colorHex ?? prev.colorHex,
          seasons: next.seasons.length > 0 ? next.seasons : prev.seasons,
          occasions: next.occasions.length > 0 ? next.occasions : prev.occasions,
          warmth: next.warmth ?? prev.warmth,
        }));
        setAnalysis({ status: 'done' });
      } else {
        setAnalysis({ status: 'failed' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [photoUrl]);

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
    reader.onerror = () =>
      setPhotoError('Could not read that photo. Please try a different file.');
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

  const toggleSeason = (s: WardrobeSeason) => {
    setSuggestion((prev) => ({
      ...prev,
      seasons: prev.seasons.includes(s)
        ? prev.seasons.filter((x) => x !== s)
        : [...prev.seasons, s],
    }));
  };

  const submit = async (verified: boolean) => {
    if (submitting) return;
    setSubmitError(null);
    if (verified && !photoUrl) {
      setSubmitError('Add a photo first — Ready items require a photo.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = suggestionToPayload(suggestion, photoUrl, verified);
      const item = await add(payload, clientId);
      if (!item) {
        setSubmitError('Could not save. Please try again.');
        return;
      }
      onSaved?.(item.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Review wardrobe item"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              Review &amp; Confirm
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Check the auto-tagged details before adding to your wardrobe.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded hover:bg-[var(--bg-hover)]"
            disabled={submitting}
          >
            <X size={18} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Photo */}
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
              <div className="text-xs" style={{ color: 'var(--error)' }} role="alert">
                {photoError}
              </div>
            )}
            {photoUrl ? (
              <div className="space-y-2">
                <div
                  className="rounded-xl overflow-hidden flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    maxHeight: 220,
                  }}
                >
                  <img
                    src={photoUrl}
                    alt=""
                    className="w-full h-full object-cover max-h-52"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPhotoUrl(null)}
                    className="text-xs underline"
                    style={{ color: 'var(--text-muted)' }}
                    disabled={submitting}
                  >
                    Remove photo
                  </button>
                  <AnalysisBadge analysis={analysis} />
                </div>
              </div>
            ) : (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Adding a photo unlocks auto-tagging and “Mark Ready” for strict outfits.
              </div>
            )}
          </div>
        </Field>

        {/* Category */}
        <Field label="Category">
          <select
            value={suggestion.category}
            onChange={(e) =>
              setSuggestion({
                ...suggestion,
                category: e.target.value as WardrobeCategory,
              })
            }
            className="w-full px-3 py-2 rounded-lg text-sm capitalize"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
            disabled={submitting}
          >
            {WARDROBE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        {/* Color + Subtype */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Color">
            <input
              type="text"
              value={suggestion.color ?? ''}
              onChange={(e) =>
                setSuggestion({ ...suggestion, color: e.target.value || null })
              }
              placeholder="e.g. black"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
              }}
              disabled={submitting}
            />
          </Field>
          <Field label="Subtype">
            <input
              type="text"
              value={suggestion.subtype ?? ''}
              onChange={(e) =>
                setSuggestion({ ...suggestion, subtype: e.target.value || null })
              }
              placeholder="e.g. tshirt"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
              }}
              disabled={submitting}
            />
          </Field>
        </div>

        {/* Warmth */}
        <Field label="Warmth">
          <div className="flex gap-2">
            {WARMTHS.map((w) => {
              const active = suggestion.warmth === w;
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() =>
                    setSuggestion({ ...suggestion, warmth: active ? null : w })
                  }
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs capitalize"
                  style={{
                    backgroundColor: active
                      ? 'var(--accent-style)'
                      : 'var(--bg-surface-elevated)',
                    color: active ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    opacity: submitting ? 0.6 : 1,
                  }}
                  disabled={submitting}
                >
                  {w}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Seasons */}
        <Field label="Seasons">
          <div className="flex gap-2 flex-wrap">
            {SEASONS.map((s) => {
              const active = suggestion.seasons.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSeason(s)}
                  aria-pressed={active}
                  className="px-3 py-1.5 rounded-full text-xs capitalize"
                  style={{
                    backgroundColor: active
                      ? 'var(--accent-style)'
                      : 'var(--bg-surface-elevated)',
                    color: active ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    opacity: submitting ? 0.6 : 1,
                  }}
                  disabled={submitting}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </Field>

        {submitError && (
          <div
            className="text-xs px-3 py-2 rounded-lg"
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              color: 'var(--error)',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
            role="alert"
          >
            {submitError}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={submitting}
            className="py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={submitting}
            className="py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]"
            style={{
              backgroundColor: 'var(--accent-style)',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(232,121,160,0.3)',
            }}
            aria-label="Mark ready for outfits"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
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
      <span
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function AnalysisBadge({ analysis }: { analysis: AnalysisState }) {
  if (analysis.status === 'running') {
    return (
      <div
        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full"
        style={{
          backgroundColor: 'rgba(124,106,252,0.15)',
          color: 'var(--accent-global)',
        }}
      >
        <Loader2 size={11} className="animate-spin" />
        Analyzing…
      </div>
    );
  }
  if (analysis.status === 'done') {
    return (
      <div
        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full"
        style={{
          backgroundColor: 'rgba(34,211,160,0.14)',
          color: 'var(--accent-fitness)',
        }}
      >
        <Sparkles size={11} />
        Auto-tagged
      </div>
    );
  }
  if (analysis.status === 'failed') {
    return (
      <div
        className="text-[11px] font-medium"
        style={{ color: 'var(--text-muted)' }}
      >
        Auto-tag unavailable — fill in manually.
      </div>
    );
  }
  return null;
}
