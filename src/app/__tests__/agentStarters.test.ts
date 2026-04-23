import { describe, it, expect } from 'vitest';
import { agentStarters, starterChipLabels } from '../agentStarters';
import { agents, type AgentId } from '../types';

const ALL_AGENTS: AgentId[] = ['all', 'style', 'travel', 'fitness', 'lifestyle'];

describe('agentStarters', () => {
  it('provides starters for every agent', () => {
    for (const id of ALL_AGENTS) {
      expect(agentStarters[id]).toBeDefined();
      expect(agentStarters[id].length).toBeGreaterThanOrEqual(3);
    }
  });

  it('covers every registered agent in types.ts', () => {
    for (const id of Object.keys(agents) as AgentId[]) {
      expect(agentStarters[id]).toBeDefined();
    }
  });

  it('every starter has a non-empty id, label, prompt, and hint', () => {
    for (const id of ALL_AGENTS) {
      for (const s of agentStarters[id]) {
        expect(s.id).toMatch(/^[a-z0-9-]+$/);
        expect(s.label.length).toBeGreaterThan(2);
        expect(s.prompt.length).toBeGreaterThan(5);
        expect(s.hint.length).toBeGreaterThan(3);
      }
    }
  });

  it('starter ids are unique per agent', () => {
    for (const id of ALL_AGENTS) {
      const ids = agentStarters[id].map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('travel starters mention flight or hotel or trip (outcome clarity)', () => {
    const travelText = agentStarters.travel
      .map((s) => `${s.label} ${s.prompt} ${s.hint}`)
      .join(' ')
      .toLowerCase();
    expect(travelText).toMatch(/flight|hotel|trip|itinerary/);
  });

  it('fitness starters reference classes, studios, or gyms', () => {
    const fitnessText = agentStarters.fitness
      .map((s) => `${s.label} ${s.prompt} ${s.hint}`)
      .join(' ')
      .toLowerCase();
    expect(fitnessText).toMatch(/yoga|class|studio|gym|hiit|workout/);
  });

  it('lifestyle starters reference reminders', () => {
    const lifestyleText = agentStarters.lifestyle
      .map((s) => `${s.label} ${s.prompt} ${s.hint}`)
      .join(' ')
      .toLowerCase();
    expect(lifestyleText).toMatch(/remind|reminder/);
  });

  it('style starters reference photo / colors / outfit / wearing', () => {
    const styleText = agentStarters.style
      .map((s) => `${s.label} ${s.prompt} ${s.hint}`)
      .join(' ')
      .toLowerCase();
    expect(styleText).toMatch(/photo|selfie|outfit|color|wear/);
  });

  it('all-agent starters expose multiple domains so users see routing works', () => {
    const labels = agentStarters.all.map((s) => `${s.label} ${s.hint}`.toLowerCase()).join(' ');
    expect(labels).toMatch(/travel|flight|hotel|trip/);
    expect(labels).toMatch(/yoga|fitness|gym|class/);
    expect(labels).toMatch(/remind/);
  });
});

describe('starterChipLabels', () => {
  it('returns at most N starters', () => {
    for (const id of ALL_AGENTS) {
      expect(starterChipLabels(id, 3).length).toBeLessThanOrEqual(3);
      expect(starterChipLabels(id, 1).length).toBeLessThanOrEqual(1);
    }
  });

  it('returns a prefix of agentStarters (preserves order)', () => {
    for (const id of ALL_AGENTS) {
      const chips = starterChipLabels(id, 2);
      expect(chips).toEqual(agentStarters[id].slice(0, 2));
    }
  });

  it('every chip has prompt text suitable for auto-send', () => {
    const chips = starterChipLabels('travel', 3);
    for (const c of chips) {
      expect(typeof c.prompt).toBe('string');
      expect(c.prompt.trim().length).toBeGreaterThan(5);
    }
  });
});
