import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../config/agents.js';

const AGENTS = ['style', 'travel', 'fitness', 'lifestyle'] as const;

describe('agent system prompts — grounding', () => {
  it.each(AGENTS)('%s prompt never instructs the model to emit card JSON', (agentId) => {
    const prompt = buildSystemPrompt(agentId, {});
    expect(prompt).not.toMatch(/RICH CARD TRIGGERS/);
    expect(prompt).not.toMatch(/include structured data for a PlaceCard/i);
    expect(prompt).not.toMatch(/include structured data for a FlightCard/i);
    expect(prompt).not.toMatch(/include structured data for a FitnessClassCard/i);
    expect(prompt).not.toMatch(/include structured data for a ReminderCard/i);
    expect(prompt).not.toMatch(/Respond with structured data for the ColorSeasonCard/i);
  });

  it.each(['travel', 'fitness', 'lifestyle'] as const)(
    '%s prompt tells the model to use search_places for specific businesses',
    (agentId) => {
      const prompt = buildSystemPrompt(agentId, {});
      expect(prompt).toMatch(/search_places/);
      expect(prompt).toMatch(/never fabricate specifics/i);
    }
  );

  it('lifestyle prompt explicitly disclaims reminder persistence', () => {
    const prompt = buildSystemPrompt('lifestyle', {});
    expect(prompt).toMatch(/reminders are \*\*not yet persisted\*\*/i);
  });

  it('travel prompt tells the model to use search_flights for real offers', () => {
    const prompt = buildSystemPrompt('travel', {});
    expect(prompt).toMatch(/search_flights/);
    expect(prompt).toMatch(/IATA/);
    expect(prompt).toMatch(/Never invent airlines, flight numbers, times, or prices/i);
  });

  it('travel prompt tells the model to use search_hotels for real rooms', () => {
    const prompt = buildSystemPrompt('travel', {});
    expect(prompt).toMatch(/search_hotels/);
    expect(prompt).toMatch(/IATA \*\*city\*\* codes|IATA city codes/i);
    expect(prompt).toMatch(/Never invent hotel names, addresses, star ratings, or room prices/i);
  });

  it('fitness prompt tells the model to use find_fitness_classes for real schedules', () => {
    const prompt = buildSystemPrompt('fitness', {});
    expect(prompt).toMatch(/find_fitness_classes/);
    expect(prompt).toMatch(/ClassPass/);
    expect(prompt).toMatch(/Mindbody/);
    expect(prompt).toMatch(/NEVER invent class times/i);
  });
});
