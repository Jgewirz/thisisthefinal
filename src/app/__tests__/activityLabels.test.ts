import { describe, it, expect } from 'vitest';
import { activityLabel, activityBaseLabel } from '../activityLabels';
import type { ActivityKind, ActivityState } from '../types';

function mk(kind: ActivityKind, detail?: string): ActivityState {
  return { kind, detail, startedAt: 0 };
}

describe('activityLabel', () => {
  it('returns empty string when no activity is present', () => {
    expect(activityLabel(null)).toBe('');
  });

  it('maps each known ActivityKind to a short label', () => {
    const kinds: ActivityKind[] = [
      'thinking',
      'search_places',
      'search_flights',
      'search_hotels',
      'find_fitness_classes',
      'create_reminder',
      'writing',
    ];
    for (const k of kinds) {
      const label = activityLabel(mk(k));
      expect(label.length).toBeGreaterThan(0);
      // Labels should stay short enough for mobile bubbles.
      expect(label.length).toBeLessThanOrEqual(30);
    }
  });

  it('appends the detail with a bullet separator when present', () => {
    expect(activityLabel(mk('search_flights', 'JFK → CDG'))).toBe(
      'Searching flights · JFK → CDG'
    );
    expect(activityLabel(mk('search_hotels', 'Paris'))).toBe('Searching hotels · Paris');
  });

  it('trims whitespace-only details and omits the separator', () => {
    expect(activityLabel(mk('thinking', '   '))).toBe('Thinking');
    expect(activityLabel(mk('writing'))).toBe('Writing response');
  });

  it('falls back to a generic label for unknown kinds', () => {
    // Simulate a future server kind not yet known to this client build.
    expect(activityBaseLabel('mystery' as ActivityKind)).toBe('Working');
    expect(activityLabel({ kind: 'mystery' as ActivityKind, startedAt: 0 })).toBe(
      'Working'
    );
  });
});
