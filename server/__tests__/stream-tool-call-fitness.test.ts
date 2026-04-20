import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();
vi.mock('openai', () => {
  class FakeOpenAI {
    chat = { completions: { create: createMock } };
    constructor(_: unknown) {}
  }
  return { default: FakeOpenAI };
});

const searchFitnessMock = vi.fn();
const buildAggregatorLinksMock = vi.fn(() => [
  { id: 'classpass', name: 'ClassPass', url: 'https://classpass.com/search?q=fallback' },
  { id: 'mindbody', name: 'Mindbody', url: 'https://explore.mindbodyonline.com/search?q=fallback' },
  { id: 'googlemaps', name: 'Google Maps', url: 'https://www.google.com/maps/search/?query=fallback' },
]);
vi.mock('../services/fitnessClasses.js', () => ({
  searchFitnessClasses: searchFitnessMock,
  buildAggregatorLinks: buildAggregatorLinksMock,
}));

// Stub siblings to avoid pulling real services.
vi.mock('../services/places.js', () => ({
  searchPlaces: vi.fn(),
  buildSearchTextBody: () => ({}),
}));
vi.mock('../services/amadeus.js', () => ({
  searchFlights: vi.fn(),
  buildGoogleFlightsUrl: () => 'https://example.test',
}));
vi.mock('../services/amadeusHotels.js', () => ({ searchHotels: vi.fn() }));
vi.mock('../services/reminders.js', () => ({ createReminder: vi.fn() }));

async function* asyncIter<T>(items: T[]) {
  for (const i of items) yield i;
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
  createMock.mockReset();
  searchFitnessMock.mockReset();
  buildAggregatorLinksMock.mockClear();
});

const parisLocation = { lat: 48.8566, lng: 2.3522 };

describe('streamChat — find_fitness_classes tool', () => {
  it('emits a classList card with studios + aggregator links', async () => {
    searchFitnessMock.mockResolvedValue({
      activity: 'yoga',
      when: 'tomorrow 8am',
      cityName: 'Paris',
      studios: [
        {
          id: 'p1',
          name: 'Paris Flow Yoga',
          address: '12 Rue',
          websiteUri: 'https://paris-flow.example',
        },
      ],
      aggregatorLinks: [
        { id: 'classpass', name: 'ClassPass', url: 'https://classpass.com/search?q=yoga' },
        { id: 'mindbody', name: 'Mindbody', url: 'https://explore.mindbodyonline.com/search?q=yoga' },
        { id: 'googlemaps', name: 'Google Maps', url: 'https://www.google.com/maps/search/?query=yoga' },
      ],
    });

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'tc_f1',
                type: 'function',
                function: {
                  name: 'find_fitness_classes',
                  arguments: JSON.stringify({
                    activity: 'yoga',
                    cityName: 'Paris',
                    when: 'tomorrow 8am',
                  }),
                },
              },
            ],
          },
        },
      ],
    });
    createMock.mockResolvedValueOnce(
      asyncIter([{ choices: [{ delta: { content: 'Tap ClassPass for times.' } }] }])
    );

    const { streamChat } = await import('../services/anthropic.js');
    const events: any[] = [];
    for await (const evt of streamChat(
      'fitness',
      [{ role: 'user', content: 'yoga tomorrow 8am in Paris' }],
      undefined,
      undefined,
      parisLocation
    )) {
      events.push(evt);
    }

    expect(searchFitnessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: 'yoga',
        cityName: 'Paris',
        when: 'tomorrow 8am',
        location: parisLocation,
      })
    );

    const card = events.find((e) => e.type === 'card');
    expect(card).toBeDefined();
    expect(card.card.type).toBe('classList');
    expect(card.card.data.studios).toHaveLength(1);
    expect(card.card.data.aggregatorLinks.map((l: any) => l.id)).toEqual([
      'classpass',
      'mindbody',
      'googlemaps',
    ]);
    expect(card.card.data.providerError).toBeUndefined();

    // Tool registered on first call.
    const firstCallArgs = createMock.mock.calls[0]![0];
    const toolNames = (firstCallArgs.tools || []).map((t: any) => t.function.name);
    expect(toolNames).toContain('find_fitness_classes');

    // Grounding instructs model not to invent class times.
    const sysMsgs = createMock.mock.calls[1]![0].messages.filter(
      (m: any) => m.role === 'system'
    );
    expect(
      sysMsgs.some((m: any) =>
        /DO NOT invent specific class times|remind the user to tap a studio/i.test(
          m.content ?? ''
        )
      )
    ).toBe(true);
  });

  it('surfaces provider errors with fallback aggregator links + grounding', async () => {
    searchFitnessMock.mockRejectedValue(
      new Error('find_fitness_classes: Places API 500: boom')
    );

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'tc_f2',
                type: 'function',
                function: {
                  name: 'find_fitness_classes',
                  arguments: JSON.stringify({ activity: 'pilates', cityName: 'Paris' }),
                },
              },
            ],
          },
        },
      ],
    });
    createMock.mockResolvedValueOnce(
      asyncIter([{ choices: [{ delta: { content: 'temporarily unavailable' } }] }])
    );

    const { streamChat } = await import('../services/anthropic.js');
    const events: any[] = [];
    for await (const evt of streamChat(
      'fitness',
      [{ role: 'user', content: 'pilates' }],
      undefined,
      undefined,
      parisLocation
    )) {
      events.push(evt);
    }

    const card = events.find((e) => e.type === 'card');
    expect(card.card.type).toBe('classList');
    expect(card.card.data.studios).toEqual([]);
    expect(card.card.data.providerError).toMatch(/Places API 500/);
    expect(card.card.data.aggregatorLinks).toHaveLength(3);
    expect(buildAggregatorLinksMock).toHaveBeenCalled();

    const sysMsgs = createMock.mock.calls[1]![0].messages.filter(
      (m: any) => m.role === 'system'
    );
    expect(
      sysMsgs.some((m: any) =>
        /live studio directory|temporarily unavailable/i.test(m.content ?? '')
      )
    ).toBe(true);
  });

  it('is NOT registered when user has no location', async () => {
    createMock.mockResolvedValueOnce(
      asyncIter([{ choices: [{ delta: { content: 'need location' } }] }])
    );
    const { streamChat } = await import('../services/anthropic.js');
    for await (const _ of streamChat(
      'fitness',
      [{ role: 'user', content: 'yoga' }],
      undefined,
      undefined,
      undefined
    )) {
      // drain
    }
    // Without location, no tools are enabled for fitness → plain streaming call.
    expect(createMock.mock.calls[0]![0].tools).toBeUndefined();
  });

  it('is NOT registered on the travel agent', async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: 'hi', tool_calls: [] } }],
    });
    const { streamChat } = await import('../services/anthropic.js');
    for await (const _ of streamChat(
      'travel',
      [{ role: 'user', content: 'hi' }],
      undefined,
      undefined,
      parisLocation
    )) {
      // drain
    }
    const toolNames = (createMock.mock.calls[0]![0].tools || []).map(
      (t: any) => t.function.name
    );
    expect(toolNames).not.toContain('find_fitness_classes');
  });
});
