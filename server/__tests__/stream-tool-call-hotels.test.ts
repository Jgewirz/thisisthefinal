import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();
vi.mock('openai', () => {
  class FakeOpenAI {
    chat = { completions: { create: createMock } };
    constructor(_: unknown) {}
  }
  return { default: FakeOpenAI };
});

const searchHotelsMock = vi.fn();
vi.mock('../services/amadeusHotels.js', () => ({
  searchHotels: searchHotelsMock,
}));

// Stub sibling services so their imports resolve.
vi.mock('../services/places.js', () => ({
  searchPlaces: vi.fn(),
  buildSearchTextBody: () => ({}),
}));
vi.mock('../services/amadeus.js', () => ({
  searchFlights: vi.fn(),
  buildGoogleFlightsUrl: (p: any) => `https://x/${p.origin}-${p.destination}`,
}));
vi.mock('../services/reminders.js', () => ({ createReminder: vi.fn() }));

async function* asyncIter<T>(items: T[]) {
  for (const i of items) yield i;
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
  createMock.mockReset();
  searchHotelsMock.mockReset();
});

describe('streamChat — search_hotels tool calling', () => {
  it('invokes search_hotels on the travel agent and emits a hotelList card with booking links', async () => {
    searchHotelsMock.mockResolvedValue({
      offers: [
        {
          id: 'o1',
          hotelId: 'H1',
          name: 'Hotel Paris',
          cityName: 'PAR',
          address: '1 Rue, Paris',
          rating: 4,
          priceTotal: '220.00',
          currency: 'EUR',
          checkIn: '2026-05-01',
          checkOut: '2026-05-05',
          bookingUrl: 'https://google.com/travel/hotels',
        },
      ],
      searchLink: 'https://google.com/travel/hotels?q=Paris',
    });

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'tc_h1',
                type: 'function',
                function: {
                  name: 'search_hotels',
                  arguments: JSON.stringify({
                    cityCode: 'par',
                    cityName: 'Paris',
                    checkIn: '2026-05-01',
                    checkOut: '2026-05-05',
                    adults: 2,
                  }),
                },
              },
            ],
          },
        },
      ],
    });
    createMock.mockResolvedValueOnce(
      asyncIter([{ choices: [{ delta: { content: 'Top pick: Hotel Paris (220 EUR).' } }] }])
    );

    const { streamChat } = await import('../services/anthropic.js');
    const events: any[] = [];
    for await (const evt of streamChat(
      'travel',
      [{ role: 'user', content: 'hotels in Paris May 1-5 2026 for 2 adults' }],
      undefined,
      undefined,
      undefined
    )) {
      events.push(evt);
    }

    // cityCode passed through uppercased by the anthropic dispatch.
    expect(searchHotelsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cityCode: 'PAR',
        cityName: 'Paris',
        checkIn: '2026-05-01',
        checkOut: '2026-05-05',
        adults: 2,
      })
    );

    const cardEvt = events.find((e) => e.type === 'card');
    expect(cardEvt).toBeDefined();
    expect(cardEvt.card.type).toBe('hotelList');
    expect(cardEvt.card.data.offers).toHaveLength(1);
    expect(cardEvt.card.data.offers[0].name).toBe('Hotel Paris');
    const linkIds = (cardEvt.card.data.bookingLinks || []).map((l: any) => l.id);
    expect(linkIds).toEqual(['booking', 'hotels', 'airbnb', 'google']);

    // First call must have registered the hotels tool.
    const firstCallArgs = createMock.mock.calls[0]![0];
    const toolNames = (firstCallArgs.tools || []).map((t: any) => t.function.name);
    expect(toolNames).toContain('search_hotels');

    // Grounding must tell the model to summarize, not invent.
    const second = createMock.mock.calls[1]![0].messages;
    const sysMsgs = second.filter((m: any) => m.role === 'system');
    expect(
      sysMsgs.some((m: any) =>
        /summarize hotels|only reference hotels/i.test(m.content ?? '')
      )
    ).toBe(true);
  });

  it('emits empty hotelList + zero-result grounding on no offers', async () => {
    searchHotelsMock.mockResolvedValue({
      offers: [],
      searchLink: 'https://google.com/travel/hotels',
    });

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'tc_h2',
                type: 'function',
                function: {
                  name: 'search_hotels',
                  arguments: JSON.stringify({
                    cityCode: 'ZZZ',
                    checkIn: '2099-01-01',
                    checkOut: '2099-01-05',
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
      [{ role: 'user', content: 'hotels ZZZ' }],
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
      sysMsgs.some((m: any) =>
        /zero offers|no live offers|booking\.com|airbnb/i.test(m.content ?? '')
      )
    ).toBe(true);
  });

  it('surfaces provider errors on the card and grounding', async () => {
    searchHotelsMock.mockRejectedValue(
      new Error('Amadeus 500: Internal error — An internal error occurred')
    );
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'tc_h3',
                type: 'function',
                function: {
                  name: 'search_hotels',
                  arguments: JSON.stringify({
                    cityCode: 'PAR',
                    checkIn: '2026-05-01',
                    checkOut: '2026-05-05',
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
      [{ role: 'user', content: 'Paris hotels' }],
      undefined,
      undefined,
      undefined
    )) {
      events.push(evt);
    }

    const card = events.find((e) => e.type === 'card');
    expect(card.card.type).toBe('hotelList');
    expect(card.card.data.offers).toEqual([]);
    expect(card.card.data.providerError).toMatch(/Amadeus 500/);
    expect((card.card.data.bookingLinks || []).length).toBe(4);

    const sysMsgs = createMock.mock.calls[1]![0].messages.filter(
      (m: any) => m.role === 'system'
    );
    expect(
      sysMsgs.some((m: any) =>
        /temporarily unavailable|hotel-offers provider/i.test(m.content ?? '')
      )
    ).toBe(true);
  });

  it('does not register the hotels tool for the fitness agent', async () => {
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
      // drain
    }
    const firstCallArgs = createMock.mock.calls[0]![0];
    expect(firstCallArgs.tools).toBeUndefined();
  });
});
