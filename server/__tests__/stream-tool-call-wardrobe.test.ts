import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();
vi.mock('openai', () => {
  class FakeOpenAI {
    chat = { completions: { create: createMock } };
    constructor(_: unknown) {}
  }
  return { default: FakeOpenAI };
});

const listWardrobeItemsMock = vi.fn();
vi.mock('../services/wardrobe.js', () => ({
  listWardrobeItems: listWardrobeItemsMock,
}));

// Silence mocks for services not exercised in this suite.
vi.mock('../services/places.js', () => ({
  searchPlaces: vi.fn().mockResolvedValue([]),
  buildSearchTextBody: () => ({}),
}));
vi.mock('../services/amadeus.js', () => ({
  searchFlights: vi.fn(),
  buildGoogleFlightsUrl: () => 'https://flights.google.com',
}));
vi.mock('../services/flightLinks.js', () => ({ buildBookingLinks: () => [] }));
vi.mock('../services/amadeusHotels.js', () => ({ searchHotels: vi.fn() }));
vi.mock('../services/hotelLinks.js', () => ({ buildHotelBookingLinks: () => [{ name: 'Booking', url: 'https://booking.com' }] }));
vi.mock('../services/fitnessClasses.js', () => ({
  searchFitnessClasses: vi.fn(),
  buildAggregatorLinks: () => [],
}));
vi.mock('../services/reminders.js', () => ({ createReminder: vi.fn() }));

async function* asyncIter<T>(items: T[]) {
  for (const i of items) yield i;
}

const VERIFIED_ITEM = {
  id: 'w1',
  user_id: 'u1',
  image_url: 'data:image/png;base64,FAKE',
  category: 'top',
  subtype: 'tshirt',
  color: 'black',
  color_hex: '#000',
  pattern: null,
  seasons: ['summer'],
  occasions: ['casual'],
  warmth: 'light',
  attributes: { verified: true },
  created_at: new Date().toISOString(),
};

const DRAFT_ITEM = {
  ...VERIFIED_ITEM,
  id: 'w2',
  image_url: null,
  color: 'navy',
  attributes: {},
};

describe('streamChat — list_wardrobe tool', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    createMock.mockReset();
    listWardrobeItemsMock.mockReset();
  });

  it('calls list_wardrobe when model requests it and emits activity + grounded tool message', async () => {
    listWardrobeItemsMock.mockResolvedValue([VERIFIED_ITEM, DRAFT_ITEM]);

    // Step 1: model requests list_wardrobe
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'tc_1',
                type: 'function',
                function: {
                  name: 'list_wardrobe',
                  arguments: JSON.stringify({ verified_only: false }),
                },
              },
            ],
          },
        },
      ],
    });

    // Step 2: model streams a response
    createMock.mockResolvedValueOnce(
      asyncIter([
        { choices: [{ delta: { content: 'You have a black tshirt' } }] },
        { choices: [{ delta: { content: ' and a navy top.' } }] },
      ])
    );

    const { streamChat } = await import('../services/anthropic.js');
    const events: any[] = [];
    for await (const evt of streamChat(
      'style',
      [{ role: 'user', content: 'what outfits can I make?' }],
      undefined,
      undefined,
      undefined,
      'user-1'
    )) {
      events.push(evt);
    }

    // Activity event fired
    expect(events.some((e) => e.type === 'activity' && e.kind === 'list_wardrobe')).toBe(true);

    // listWardrobeItems was called with the correct userId
    expect(listWardrobeItemsMock).toHaveBeenCalledWith('user-1', expect.objectContaining({ limit: 200 }));

    // Streamed tokens include both items from the mock
    const tokens = events
      .filter((e) => e.type === 'token')
      .map((e) => e.text)
      .join('');
    expect(tokens).toContain('black tshirt');

    // The second OpenAI call received a tool message with the compact wardrobe
    const secondCallArgs = createMock.mock.calls[1][0];
    const toolMsg = secondCallArgs.messages.find((m: any) => m.role === 'tool');
    expect(toolMsg).toBeDefined();
    const body = JSON.parse(toolMsg.content);
    expect(body.total).toBe(2);
    expect(body.ready).toBe(1);
    expect(body.draft).toBe(1);
    // base64 image_url must NOT be present; only has_photo boolean
    expect(JSON.stringify(body)).not.toContain('data:image');
    expect(body.items[0].has_photo).toBe(true);
    expect(body.items[1].has_photo).toBe(false);
  });

  it('filters to verified_only when arg is true', async () => {
    listWardrobeItemsMock.mockResolvedValue([VERIFIED_ITEM, DRAFT_ITEM]);

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'tc_2',
                type: 'function',
                function: {
                  name: 'list_wardrobe',
                  arguments: JSON.stringify({ verified_only: true }),
                },
              },
            ],
          },
        },
      ],
    });

    createMock.mockResolvedValueOnce(asyncIter([{ choices: [{ delta: { content: 'Ready items only.' } }] }]));

    const { streamChat } = await import('../services/anthropic.js');
    const events: any[] = [];
    for await (const evt of streamChat('style', [{ role: 'user', content: 'show ready items' }], undefined, undefined, undefined, 'user-1')) {
      events.push(evt);
    }

    const toolMsg = createMock.mock.calls[1][0].messages.find((m: any) => m.role === 'tool');
    const body = JSON.parse(toolMsg.content);
    // Only verified items should appear
    expect(body.total).toBe(1);
    expect(body.items[0].ready).toBe(true);
  });

  it('does NOT expose the tool when agentId is not style or all', async () => {
    // For travel agent, list_wardrobe should not be in the tool list at all
    createMock.mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: 'no tools', tool_calls: [] } }],
    });
    createMock.mockResolvedValueOnce(asyncIter([{ choices: [{ delta: { content: 'ok' } }] }]));

    const { streamChat } = await import('../services/anthropic.js');
    for await (const _ of streamChat('travel', [{ role: 'user', content: 'hi' }], undefined, undefined, undefined, 'user-1')) {}

    const firstCallArgs = createMock.mock.calls[0][0];
    const toolNames = firstCallArgs.tools?.map((t: any) => t.function?.name) ?? [];
    expect(toolNames).not.toContain('list_wardrobe');
  });

  it('returns an error payload gracefully when DB throws', async () => {
    listWardrobeItemsMock.mockRejectedValue(new Error('db timeout'));

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              { id: 'tc_3', type: 'function', function: { name: 'list_wardrobe', arguments: '{}' } },
            ],
          },
        },
      ],
    });

    createMock.mockResolvedValueOnce(asyncIter([{ choices: [{ delta: { content: 'Sorry.' } }] }]));

    const { streamChat } = await import('../services/anthropic.js');
    const events: any[] = [];
    for await (const evt of streamChat('style', [{ role: 'user', content: 'my wardrobe?' }], undefined, undefined, undefined, 'user-1')) {
      events.push(evt);
    }

    const toolMsg = createMock.mock.calls[1][0].messages.find((m: any) => m.role === 'tool');
    const body = JSON.parse(toolMsg.content);
    expect(body.error).toMatch(/db timeout/);
    // Stream still completes — no crash
    expect(events.some((e) => e.type === 'token')).toBe(true);
  });
});
