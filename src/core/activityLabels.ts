import type { ActivityKind, ActivityState } from './types';

/**
 * Maps a transient `ActivityKind` to the user-facing label shown inside
 * the "thinking" indicator. Labels are deliberately short (<= 24 chars)
 * so they fit on a mobile bubble without wrapping.
 */
const BASE_LABELS: Record<ActivityKind, string> = {
  thinking: 'Thinking',
  search_places: 'Searching Google Places',
  search_flights: 'Searching flights',
  search_hotels: 'Searching hotels',
  find_fitness_classes: 'Finding studios',
  create_reminder: 'Creating reminder',
  list_wardrobe: 'Reading your wardrobe',
  writing: 'Writing response',
};

/**
 * Returns the full user-facing label, including any trailing detail
 * (e.g. "Searching flights · JFK → CDG"). Never throws; falls back to a
 * generic "Working…" label for unknown kinds so future tool additions
 * degrade gracefully in an already-deployed client.
 */
export function activityLabel(activity: ActivityState | null): string {
  if (!activity) return '';
  const base = BASE_LABELS[activity.kind] ?? 'Working';
  const detail = activity.detail?.trim();
  return detail ? `${base} · ${detail}` : base;
}

/** Exported for tests / a11y live-regions that want the base label only. */
export function activityBaseLabel(kind: ActivityKind): string {
  return BASE_LABELS[kind] ?? 'Working';
}

