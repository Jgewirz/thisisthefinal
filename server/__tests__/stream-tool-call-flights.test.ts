import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();
vi.mock('openai', () => {
  class FakeOpenAI {
    chat = { completions: { create: createMock } };
    constructor(_: unknown) {}
  }
  return { default: FakeOpenAI };
});

const searchFlightsMock = vi.fn();
vi.mock('../services/amadeus.js', () => ({
  searchFlights: searchFlightsMock,
  buildGoogleFlightsUrl: (p: any) =>
    `https://google.com/flights?q=${p.origin}-${p.destination}`,
}));

// Also stub places so top-level import is happy and we don't accidentally exercise it.
vi.mock('../services/places.js', () => ({
  searchPlaces: vi.fn(),
  buildSearchTextBody: () => ({}),
}));

async function* asyncIter<T>(items: T[]) {
  for (const i of items) yield i;
}

describe('streamChat — flight tool calling', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    createMock.mockReset();
    searchFlightsMock.mockReset();
  });

  it('invokes search_flights on the travel agent and emits a flightList card', async () => {
    const offer = {
      id: '1',
      priceTotal: '432.10',
      currency: 'USD',
      itineraries: [
        {
          durationMinutes: 750,
          stops: 0,
          segments: [
            {
              carrier: 'UA',
              flightNumber: 'UA901',
              from: 'JFK',
              to: 'LHR',
              departAt: '2026-05-01T18:00:00',
              arriveAt: '2026-05-02T06:30:00',
              durationMinutes: 750,
            },
          ],
        },
      ],
      bookingUrl: 'https://google.com/flights?q=JFK-LHR',
    };
    searchFlightsMock.mockResolvedValue({
      offers: [offer],
      searchLink: 'https://google.com/flights?q=JFK-LHR',
    });

    // 1) tool-check returns a search_flights tool call.
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
                  name: 'search_flights',
                  arguments: JSON.stringify({
                    origin: 'JFK',
                    destination: 'LHR',
                    departDate: '2026-05-01',
                    adults: 2,
                  }),
                },
              },
            ],
          },
        },
      ],
    });
    // 2) streaming finalizer.
    createMock.mockResolvedValueOnce(
      asyncIter([
        { choices: [{ delta: { content: 'Best' } }] },
        { choices: [{ delta: { content: ' pick: UA901.' } }] },
      ])
    );

    const { streamChat } = await import('../services/anthropic.js');
    const events: any[] = [];
    for await (const evt of streamChat(
      'travel',
      [{ role: 'user', content: 'find flights JFK to LHR on May 1 2026' }],
      undefined,
      undefined,
      // No location — flights tool must still be enabled for the travel agent.
      undefined
    )) {
      events.push(evt);
    }

    expect(searchFlightsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'JFK',
        destination: 'LHR',
        departDate: '2026-05-01',
        adults: 2,
      })
    );

    const cardEvt = events.find((e) => e.type === 'card');
    expect(cardEvt).toBeDefined();
    expect(cardEvt.card.type).toBe('flightList');
    expect(cardEvt.card.data.offers).toHaveLength(1);
    expect(cardEvt.card.data.offers[0].id).toBe('1');
    expect(cardEvt.card.data.searchLink).toContain('google.com/flights');
    expect(cardEvt.card.data.query).toMatchObject({
      origin: 'JFK',
      destination: 'LHR',
      departDate: '2026-05-01',
    });
    // Every flightList card must ship actionable booking deep links.
    const ids = (cardEvt.card.data.bookingLinks || []).map((l: any) => l.id);
    expect(ids).toEqual(['google', 'kayak', 'skyscanner', 'momondo']);

    const tokens = events.filter((e) => e.type === 'token').map((e) => e.text);
    expect(tokens.join('')).toBe('Best pick: UA901.');

    // First call must have registered the flights tool.
    const firstCallArgs = createMock.mock.calls[0]![0];
    const toolNames = (firstCallArgs.tools || []).map((t: any) => t.function.name);
    expect(toolNames).toContain('search_flights');
    expect(toolNames).not.toContain('search_places');
  });

  it('emits an empty flightList + zero-result grounding message on no offers', async () => {
    searchFlightsMock.mockResolvedValue({ offers: [], searchLink: 'https://x' });

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
                  name: 'search_flights',
                  arguments: JSON.stringify({
                    origin: 'ZZZ',
                    destination: 'YYY',
                    departDate: '2099-01-01',
                  }),
                },
              },
            ],
          },
        },
      ],
    });
    createMock.mockResolvedValueOnce(
      asyncIter([{ choices: [{ delta: { content: 'none' } }] }])
    );

    const { streamChat } = await import('../services/anthropic.js');
    const events: any[] = [];
    for await (const evt of streamChat(
      'travel',
      [{ role: 'user', content: 'find flights' }],
      undefined,
      undefined,
      undefined
    )) {
      events.push(evt);
    }

    const card = events.find((e) => e.type === 'card');
    expect(card.card.data.offers).toEqual([]);

    const secondCallMessages = createMock.mock.calls[1]![0].messages;
    const sysMsgs = secondCallMessages.filter((m: any) => m.role === 'system');
    expect(
      sysMsgs.some((m: any) => /search_flights returned zero|no live offers|do not invent/i.test(m.content ?? ''))
    ).toBe(true);
  });

  it('surfaces provider errors on the card and in the grounding system message', async () => {
    searchFlightsMock.mockRejectedValue(
      new Error('Amadeus flight-offers 500: Internal error — An internal error occurred')
    );

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'tc_f3',
                type: 'function',
                function: {
                  name: 'search_flights',
                  arguments: JSON.stringify({
                    origin: 'JFK',
                    destination: 'LHR',
                    departDate: '2026-05-01',
                  }),
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
      'travel',
      [{ role: 'user', content: 'JFK to LHR' }],
      undefined,
      undefined,
      undefined
    )) {
      events.push(evt);
    }

    const card = events.find((e) => e.type === 'card');
    expect(card.card.type).toBe('flightList');
    expect(card.card.data.offers).toEqual([]);
    expect(card.card.data.providerError).toMatch(/Amadeus flight-offers 500/);
    // Even on provider error, the user must get pre-filled booking links.
    expect((card.card.data.bookingLinks || []).length).toBe(4);

    const secondCallMessages = createMock.mock.calls[1]![0].messages;
    const sysMsgs = secondCallMessages.filter((m: any) => m.role === 'system');
    expect(
      sysMsgs.some((m: any) =>
        /temporarily unavailable|provider \(amadeus\) returned an error/i.test(m.content ?? '')
      )
    ).toBe(true);
    expect(
      sysMsgs.some((m: any) => /kayak|skyscanner|momondo/i.test(m.content ?? ''))
    ).toBe(true);
  });

  it('does not register the flights tool for the fitness agent', async () => {
    createMock.mockResolvedValueOnce(
      asyncIter([{ choices: [{ delta: { content: 'hi' } }] }])
    );

    const { streamChat } = await import('../services/anthropic.js');
    for await (const _ of streamChat(
      'fitness',
      [{ role: 'user', content: 'hi' }],
      undefined,
      undefined,
      undefined
    )) {
      // consume
    }

    const firstCallArgs = createMock.mock.calls[0]![0];
    // No tools path — fitness w/o location should go straight to streaming.
    expect(firstCallArgs.tools).toBeUndefined();
    expect(firstCallArgs.stream).toBe(true);
  });
});
