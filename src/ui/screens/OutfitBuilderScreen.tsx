import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Loader2,
  RefreshCw,
  Shirt,
  Sparkles,
  Star,
} from 'lucide-react';
import { useWardrobeStore } from '../../stores/wardrobe';
import { useOutfitSavesStore } from '../../stores/outfitSaves';
import {
  generateOutfits,
  type Outfit,
  type OutfitConstraints,
  type OutfitMode,
} from '../../lib/outfits';
import { explainEmptyOutfits } from '../../lib/outfitUi';
import { countVerified } from '../../lib/wardrobeVerification';
import type {
  WardrobeItem,
  WardrobeSeason,
  WardrobeWarmth,
} from '../../lib/wardrobeApi';

/**
 * Phase 2 — Outfit Builder.
 *
 * Users pick constraints (season / warmth / occasion / palette / avoid) and we
 * run the pure `generateOutfits` against their persisted wardrobe to produce
 * ranked outfits with rationales. No server calls — the generator is fast
 * enough to run on every form change, and regenerate is just a rerun.
 *
 * Mode:
 *   strict  (default) — only photo-backed verified items qualify.
 *   explore            — includes draft items (lower confidence, labelled).
 */

const SEASONS: readonly WardrobeSeason[] = ['spring', 'summer', 'fall', 'winter'];
const WARMTHS: readonly WardrobeWarmth[] = ['light', 'medium', 'heavy'];
const OCCASION_SUGGESTIONS = ['work', 'casual', 'date', 'gym', 'formal'] as const;

export function OutfitBuilderScreen() {
  const byId = useWardrobeStore((s) => s.byId);
  const loaded = useWardrobeStore((s) => s.loaded);
  const loading = useWardrobeStore((s) => s.loading);
  const error = useWardrobeStore((s) => s.error);
  const load = useWardrobeStore((s) => s.load);

  const [occasion, setOccasion] = useState<string>('');
  const [season, setSeason] = useState<WardrobeSeason | ''>('');
  const [warmth, setWarmth] = useState<WardrobeWarmth | ''>('');
  const [paletteRaw, setPaletteRaw] = useState('');
  const [avoidRaw, setAvoidRaw] = useState('');
  const [mode, setMode] = useState<OutfitMode>('strict');
  // Nonce bumped by the Regenerate button so the memo invalidates even when
  // constraints are identical (gives a fresh candidate sort order).
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!loaded && !loading) void load();
  }, [loaded, loading, load]);

  const wardrobe = useMemo<WardrobeItem[]>(() => Object.values(byId), [byId]);
  const { verified: readyCount, draft: draftCount } = useMemo(
    () => countVerified(wardrobe),
    [wardrobe]
  );

  const constraints = useMemo<OutfitConstraints>(
    () => ({
      occasion: occasion.trim() || undefined,
      season: season || undefined,
      warmth: warmth || undefined,
      colorPalette: splitCsv(paletteRaw),
      avoidColors: splitCsv(avoidRaw),
      mode,
    }),
    [occasion, season, warmth, paletteRaw, avoidRaw, mode]
  );

  const outfits = useMemo<Outfit[]>(() => {
    void nonce;
    return generateOutfits(wardrobe, { ...constraints, limit: 8 });
  }, [wardrobe, constraints, nonce]);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header
        readyCount={readyCount}
        draftCount={draftCount}
        wardrobeLoaded={loaded}
      />
      <div className="flex-1 overflow-y-auto pb-20 sm:pb-4">
        {error && (
          <div
            className="px-4 py-2 text-xs"
            style={{ color: '#f87171', backgroundColor: 'rgba(248, 113, 113, 0.08)' }}
            role="alert"
          >
            Failed to load wardrobe: {error}
          </div>
        )}
        {loading && !loaded && (
          <div
            className="px-4 py-3 text-sm flex items-center gap-2"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Loading wardrobe"
          >
            <Loader2 size={16} className="animate-spin" />
            Loading your wardrobe…
          </div>
        )}
        <ConstraintForm
          occasion={occasion}
          season={season}
          warmth={warmth}
          paletteRaw={paletteRaw}
          avoidRaw={avoidRaw}
          mode={mode}
          onOccasion={setOccasion}
          onSeason={setSeason}
          onWarmth={setWarmth}
          onPalette={setPaletteRaw}
          onAvoid={setAvoidRaw}
          onMode={setMode}
          onRegenerate={() => setNonce((n) => n + 1)}
        />
        <Results
          outfits={outfits}
          wardrobe={wardrobe}
          constraints={constraints}
          wardrobeEmpty={wardrobe.length === 0}
          onSwitchToExplore={() => setMode('explore')}
        />
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({
  readyCount,
  draftCount,
  wardrobeLoaded,
}: {
  readyCount: number;
  draftCount: number;
  wardrobeLoaded: boolean;
}) {
  return (
    <div
      className="border-b"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-surface-elevated)',
      }}
    >
      {/* Top row */}
      <div className="h-14 flex items-center px-4">
        <Link
          to="/wardrobe"
          className="p-2 rounded-lg hover:bg-[var(--bg-surface-elevated)] active:scale-90 transition-all"
          aria-label="Back to wardrobe"
        >
          <ArrowLeft size={20} style={{ color: 'var(--text-secondary)' }} />
        </Link>
        <div className="flex items-center gap-2 ml-2">
          <Sparkles size={20} style={{ color: 'var(--accent-style)' }} />
          <h1 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Outfit Builder
          </h1>
        </div>
      </div>

      {/* Ready-items progress strip (only when wardrobe is loaded) */}
      {wardrobeLoaded && (
        <ReadyProgress readyCount={readyCount} draftCount={draftCount} />
      )}
    </div>
  );
}

function ReadyProgress({
  readyCount,
  draftCount,
}: {
  readyCount: number;
  draftCount: number;
}) {
  const MIN_READY = 2; // top + bottom (or dress)
  const hasEnough = readyCount >= MIN_READY;
  const total = readyCount + draftCount;

  if (total === 0) return null;

  return (
    <div
      className="px-4 pb-3 flex items-center gap-3"
      aria-label="Ready items progress"
    >
      {/* Mini progress bar */}
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: total > 0 ? `${Math.min(100, (readyCount / Math.max(total, MIN_READY)) * 100)}%` : '0%',
            backgroundColor: hasEnough ? '#16a34a' : 'var(--accent-style)',
          }}
        />
      </div>

      {/* Label */}
      <span
        className="text-[11px] font-medium whitespace-nowrap"
        style={{ color: hasEnough ? '#16a34a' : 'var(--text-secondary)' }}
      >
        {readyCount} Ready
        {!hasEnough && readyCount < MIN_READY && (
          <> · need {MIN_READY - readyCount} more</>
        )}
        {draftCount > 0 && (
          <span style={{ color: 'var(--text-muted)' }}> · {draftCount} draft</span>
        )}
      </span>

      {/* Link to wardrobe when not enough */}
      {!hasEnough && (
        <Link
          to="/wardrobe"
          className="text-[11px] font-semibold underline"
          style={{ color: 'var(--accent-style)' }}
        >
          Add
        </Link>
      )}
    </div>
  );
}

// ─── Constraint form ──────────────────────────────────────────────────────────

interface ConstraintFormProps {
  occasion: string;
  season: WardrobeSeason | '';
  warmth: WardrobeWarmth | '';
  paletteRaw: string;
  avoidRaw: string;
  mode: OutfitMode;
  onOccasion: (v: string) => void;
  onSeason: (v: WardrobeSeason | '') => void;
  onWarmth: (v: WardrobeWarmth | '') => void;
  onPalette: (v: string) => void;
  onAvoid: (v: string) => void;
  onMode: (v: OutfitMode) => void;
  onRegenerate: () => void;
}

function ConstraintForm(props: ConstraintFormProps) {
  return (
    <section
      className="px-4 py-4 border-b space-y-4"
      style={{ borderColor: 'var(--bg-surface-elevated)' }}
      aria-label="Outfit constraints"
    >
      {/* Strict / Explore mode toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Mode
        </span>
        <div
          className="inline-flex rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--border-subtle)' }}
          role="group"
          aria-label="Outfit mode"
        >
          {(['strict', 'explore'] as const).map((m) => {
            const active = props.mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => props.onMode(m)}
                aria-pressed={active}
                className="px-3 py-1 text-xs font-medium capitalize transition-all"
                style={{
                  backgroundColor: active ? 'var(--accent-style)' : 'transparent',
                  color: active ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
        {props.mode === 'explore' && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: 'rgba(255,200,0,0.12)',
              color: 'var(--warning)',
            }}
          >
            includes drafts
          </span>
        )}
      </div>

      <Field label="Occasion">
        <div className="flex flex-wrap gap-2 mb-2">
          {OCCASION_SUGGESTIONS.map((o) => (
            <Chip
              key={o}
              active={props.occasion === o}
              onClick={() => props.onOccasion(props.occasion === o ? '' : o)}
            >
              {o}
            </Chip>
          ))}
        </div>
        <input
          type="text"
          value={props.occasion}
          onChange={(e) => props.onOccasion(e.target.value)}
          placeholder="or type your own (brunch, wedding…)"
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid transparent',
          }}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Season">
          <SelectRow options={SEASONS} value={props.season} onChange={props.onSeason} />
        </Field>
        <Field label="Warmth">
          <SelectRow options={WARMTHS} value={props.warmth} onChange={props.onWarmth} />
        </Field>
      </div>

      <Field label="Preferred colors">
        <input
          type="text"
          value={props.paletteRaw}
          onChange={(e) => props.onPalette(e.target.value)}
          placeholder="comma-separated — e.g. navy, ivory"
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid transparent',
          }}
        />
      </Field>

      <Field label="Avoid colors">
        <input
          type="text"
          value={props.avoidRaw}
          onChange={(e) => props.onAvoid(e.target.value)}
          placeholder="comma-separated — e.g. yellow"
          className="w-full px-3 py-2 rounded-lg text-sm"
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid transparent',
          }}
        />
      </Field>

      <button
        type="button"
        onClick={props.onRegenerate}
        className="w-full py-2.5 rounded-xl font-medium text-sm inline-flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all"
        style={{ backgroundColor: 'var(--accent-style)', color: 'var(--bg-primary)' }}
      >
        <RefreshCw size={14} />
        Regenerate
      </button>
    </section>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function Results({
  outfits,
  wardrobe,
  constraints,
  wardrobeEmpty,
  onSwitchToExplore,
}: {
  outfits: Outfit[];
  wardrobe: WardrobeItem[];
  constraints: OutfitConstraints;
  wardrobeEmpty: boolean;
  onSwitchToExplore: () => void;
}) {
  if (wardrobeEmpty) {
    return (
      <section className="px-4 py-8 text-center" aria-label="Outfits">
        <EmptyIcon />
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Add a few pieces to your wardrobe to start generating outfits.
        </p>
        <Link
          to="/wardrobe"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--accent-style)', color: 'var(--bg-primary)' }}
        >
          Go to wardrobe
        </Link>
      </section>
    );
  }

  if (outfits.length === 0) {
    const explain = explainEmptyOutfits(wardrobe, constraints);
    const isStrictWithDrafts =
      (constraints.mode ?? 'strict') === 'strict' &&
      explain.title.includes('verified');

    return (
      <section className="px-4 py-8 text-center" aria-label="Outfits">
        <EmptyIcon />
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
          {explain.title}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {explain.detail}
        </p>
        {explain.tips.length > 0 && (
          <ul className="mt-3 space-y-1 text-left inline-block" aria-label="How to fix">
            {explain.tips.map((t, i) => (
              <li key={i} className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                · {t}
              </li>
            ))}
          </ul>
        )}
        {/* Actionable CTA for the strict-with-drafts state */}
        {isStrictWithDrafts && (
          <div className="mt-5 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onSwitchToExplore}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--accent-style)',
                border: '1px solid var(--accent-style)',
              }}
              aria-label="Switch to Explore mode"
            >
              Try Explore mode (use drafts)
            </button>
            <Link
              to="/wardrobe"
              className="text-xs underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Or mark items Ready in your wardrobe
            </Link>
          </div>
        )}
      </section>
    );
  }

  const savedCount = outfits.filter((o) => useOutfitSavesStore.getState().isSaved(o.id)).length;

  return (
    <section className="px-4 py-4" aria-label="Outfits">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          {outfits.length} outfit{outfits.length === 1 ? '' : 's'} generated
        </h2>
        {savedCount > 0 && (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {savedCount} saved
          </span>
        )}
      </div>
      <ul className="space-y-3" aria-label="Generated outfits">
        {outfits.map((o) => (
          <OutfitRow key={o.id} outfit={o} />
        ))}
      </ul>
    </section>
  );
}

// ─── Outfit row ───────────────────────────────────────────────────────────────

function OutfitRow({ outfit }: { outfit: Outfit }) {
  const isSaved = useOutfitSavesStore((s) => s.isSaved(outfit.id));
  const toggle = useOutfitSavesStore((s) => s.toggle);

  return (
    <li
      className="rounded-xl p-3 space-y-3"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: isSaved ? '1px solid var(--accent-style)' : '1px solid transparent',
      }}
    >
      {/* Score row + save button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Star size={14} style={{ color: 'var(--accent-style)' }} fill="currentColor" />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {outfit.score}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            / 100
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {outfit.items.length} pieces
          </span>
          <button
            type="button"
            onClick={() => toggle(outfit.id)}
            aria-pressed={isSaved}
            aria-label={isSaved ? 'Unsave outfit' : 'Save outfit'}
            className="p-1.5 rounded-lg transition-all hover:bg-[var(--bg-surface-elevated)] active:scale-90"
          >
            {isSaved ? (
              <BookmarkCheck size={16} style={{ color: 'var(--accent-style)' }} />
            ) : (
              <Bookmark size={16} style={{ color: 'var(--text-secondary)' }} />
            )}
          </button>
        </div>
      </div>

      {/* Item thumbnails */}
      <ul className="flex gap-2 overflow-x-auto" aria-label="Outfit items">
        {outfit.items.map((it) => (
          <li
            key={it.id}
            className="flex-shrink-0 w-20 rounded-lg overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface-elevated)' }}
          >
            <div className="aspect-square flex items-center justify-center">
              {it.image_url ? (
                <img
                  src={it.image_url}
                  alt={it.subtype ?? it.category}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Shirt size={22} style={{ color: 'var(--text-secondary)' }} />
              )}
            </div>
            <div
              className="px-1.5 py-1 text-[10px] capitalize truncate"
              style={{ color: 'var(--text-secondary)' }}
            >
              {it.subtype ?? it.category}
              {it.color ? (
                <span style={{ color: 'var(--text-muted)' }}> · {it.color}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {/* Reasons */}
      {outfit.reasons.length > 0 && (
        <ul className="space-y-1" aria-label="Why this works">
          {outfit.reasons.map((r, i) => (
            <li
              key={i}
              className="text-xs flex items-start gap-1.5"
              style={{ color: 'var(--text-primary)' }}
            >
              <span style={{ color: 'var(--accent-style)' }}>•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Warnings */}
      {outfit.warnings.length > 0 && (
        <ul className="space-y-1" aria-label="Warnings">
          {outfit.warnings.map((w, i) => (
            <li
              key={i}
              className="text-[11px] flex items-start gap-1.5"
              style={{ color: 'var(--warning)' }}
            >
              <span>!</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function SelectRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T | '';
  onChange: (v: T | '') => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((o) => (
        <Chip key={o} active={value === o} onClick={() => onChange(value === o ? '' : o)}>
          {o}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="px-3 py-1 rounded-full text-xs capitalize transition-all select-none"
      style={{
        backgroundColor: active ? 'var(--accent-style)' : 'var(--bg-surface-elevated)',
        color: active ? 'var(--bg-primary)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
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

function EmptyIcon() {
  return (
    <div
      className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
      style={{ backgroundColor: 'var(--bg-surface)' }}
    >
      <Shirt size={24} style={{ color: 'var(--text-secondary)' }} />
    </div>
  );
}

function splitCsv(raw: string): string[] | undefined {
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}
