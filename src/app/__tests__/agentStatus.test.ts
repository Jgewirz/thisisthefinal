import { describe, it, expect } from 'vitest';
import {
  agentStatusView,
  worstHealth,
  UNKNOWN_STATUS,
  type ProviderStatus,
} from '../agentStatus';

const ALL_UP: ProviderStatus = {
  openai: true,
  googlePlaces: true,
  amadeus: true,
  db: true,
  redis: true,
};

const NO_OPENAI: ProviderStatus = { ...ALL_UP, openai: false };
const NO_AMADEUS: ProviderStatus = { ...ALL_UP, amadeus: false };
const NO_PLACES: ProviderStatus = { ...ALL_UP, googlePlaces: false };

describe('agentStatusView — offline gate (OpenAI missing)', () => {
  it.each(['style', 'travel', 'fitness', 'lifestyle'] as const)(
    '%s agent is offline when OpenAI is missing',
    (id) => {
      const v = agentStatusView(id, NO_OPENAI);
      expect(v.health).toBe('offline');
      expect(v.label).toBe('Offline');
      expect(v.detail.toLowerCase()).toContain('openai');
    }
  );
});

describe('agentStatusView — live path', () => {
  it('style is live with openai', () => {
    expect(agentStatusView('style', ALL_UP)).toMatchObject({
      health: 'live',
      label: 'Live',
    });
  });

  it('lifestyle is live with openai (no extra deps)', () => {
    expect(agentStatusView('lifestyle', ALL_UP)).toMatchObject({
      health: 'live',
      label: 'Live',
    });
  });

  it('travel is live when amadeus is configured', () => {
    expect(agentStatusView('travel', ALL_UP)).toMatchObject({
      health: 'live',
      label: 'Live',
    });
  });

  it('fitness is live when googlePlaces is configured', () => {
    expect(agentStatusView('fitness', ALL_UP)).toMatchObject({
      health: 'live',
      label: 'Live',
    });
  });
});

describe('agentStatusView — links-only path', () => {
  it('travel degrades to links-only when amadeus is missing', () => {
    const v = agentStatusView('travel', NO_AMADEUS);
    expect(v.health).toBe('links');
    expect(v.label).toBe('Links only');
    expect(v.detail.toLowerCase()).toContain('amadeus');
  });

  it('fitness degrades to links-only when googlePlaces is missing', () => {
    const v = agentStatusView('fitness', NO_PLACES);
    expect(v.health).toBe('links');
    expect(v.label).toBe('Links only');
    expect(v.detail.toLowerCase()).toContain('google places');
  });
});

describe('agentStatusView — "all" is worst-case', () => {
  it('all agents live → all-live', () => {
    const v = agentStatusView('all', ALL_UP);
    expect(v.health).toBe('live');
  });

  it('amadeus missing → "all" becomes partial (links)', () => {
    const v = agentStatusView('all', NO_AMADEUS);
    expect(v.health).toBe('links');
    expect(v.label).toBe('Partial');
  });

  it('openai missing → "all" becomes offline', () => {
    const v = agentStatusView('all', NO_OPENAI);
    expect(v.health).toBe('offline');
    expect(v.label).toBe('Offline');
  });
});

describe('worstHealth', () => {
  it('prefers offline > links > unknown > live', () => {
    expect(worstHealth(['live', 'links', 'offline', 'live'])).toBe('offline');
    expect(worstHealth(['live', 'links', 'live'])).toBe('links');
    expect(worstHealth(['live', 'unknown', 'live'])).toBe('unknown');
    expect(worstHealth(['live', 'live'])).toBe('live');
  });
});

describe('UNKNOWN_STATUS optimistic defaults', () => {
  it('defaults openai/googlePlaces/amadeus to true so first paint is not alarming', () => {
    expect(UNKNOWN_STATUS.openai).toBe(true);
    expect(UNKNOWN_STATUS.googlePlaces).toBe(true);
    expect(UNKNOWN_STATUS.amadeus).toBe(true);
  });
});
