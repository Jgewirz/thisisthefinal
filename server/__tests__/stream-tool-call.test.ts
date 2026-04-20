import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the OpenAI SDK with a controllable create() function.
const createMock = vi.fn();

vi.mock('openai', () => {
  class FakeOpenAI {
    chat = { completions: { create: createMock } };
    constructor(_: unknown) {}
  }
  return { default: FakeOpenAI };
});

// Mock the places service so the test doesn't hit the network.
const searchPlacesMock = vi.fn();
vi.mock('../services/places.js', () => ({
  searchPlaces: searchPlacesMock,
  buildSearchTextBody: () => ({}),
}));

async function* asyncIter<T>(items: T[]) {
  for (const i of items) yield i;
}

describe('streamChat tool calling', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    createMock.mockReset();
    searchPlacesMock.mockReset();
  });

  it('invokes search_places and emits placesList card + streamed tokens', async () => {
    searchPlacesMock.mockResolvedValue([
      { id: '1', name: 'Sunrise Yoga', address: '1 Main St' },
    ]);

    // First call (with tools) returns a tool_call requesting search_places.
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
                  name: 'search_places',
                  arguments: JSON.stringify({ query: 'yoga class tomorrow' }),
                },
              },
            ],
          },
        },
      ],
    });

    // Second call returns a streaming response.
    createMock.mockResolvedValueOnce(
      asyncIter([
        { choices: [{ delta: { content: 'Found' } }] },
        { choices: [{ delta: { content: ' one!' } }] },
      ])
    );

    const { streamChat } = await import('../services/anthropic.js');
    const events: any[] = [];
    for await (const evt of streamChat(
      'fitness',
      [{ role: 'user', content: 'find yoga near me' }],
      undefined,
      undefined,
      { lat: 40.7, lng: -74 }
    )) {
      events.push(evt);
    }

    expect(searchPlacesMock).toHaveBeenCalledWith(
      'yoga class tomorrow',
      expect.objectContaining({ lat: 40.7, lng: -74 })
    );
    expect(events[0]).toEqual({
      type: 'card',
      card: {
        type: 'placesList',
        data: {
          query: 'yoga class tomorrow',
          places: [{ id: '1', name: 'Sunrise Yoga', address: '1 Main St' }],
        },
      },
    });
    expect(events.slice(1)).toEqual([
      { type: 'token', text: 'Found' },
      { type: 'token', text: ' one!' },
    ]);

    // Second call (the streaming finalizer) must carry the grounding message.
    const secondCallMessages = createMock.mock.calls[1]![0].messages;
    const groundingMsgs = secondCallMessages.filter(
      (m: any) => m.role === 'system' && typeof m.content === 'string'
    );
    expect(groundingMsgs.some((m: any) => /only reference/i.test(m.content))).toBe(true);
  });

  it('injects a "no results → do not invent" guardrail on empty tool result', async () => {
    searchPlacesMock.mockResolvedValue([]);

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
                  name: 'search_places',
                  arguments: JSON.stringify({ query: 'speakeasy in antarctica' }),
                },
              },
            ],
          },
        },
      ],
    });
    createMock.mockResolvedValueOnce(
      asyncIter([{ choices: [{ delta: { content: 'none.' } }] }])
    );

    const { streamChat } = await import('../services/anthropic.js');
    const events: any[] = [];
    for await (const evt of streamChat(
      'lifestyle',
      [{ role: 'user', content: 'find a speakeasy in antarctica' }],
      undefined,
      undefined,
      { lat: 0, lng: 0 }
    )) {
      events.push(evt);
    }

    expect(events[0]).toMatchObject({
      type: 'card',
      card: { type: 'placesList', data: { places: [] } },
    });

    const secondCallMessages = createMock.mock.calls[1]![0].messages;
    const sysMsgs = secondCallMessages.filter((m: any) => m.role === 'system');
    expect(
      sysMsgs.some((m: any) => /do not invent/i.test(m.content ?? ''))
    ).toBe(true);
  });

  it('always injects the hard grounding rule into the primary system prompt', async () => {
    createMock.mockResolvedValueOnce(
      asyncIter([{ choices: [{ delta: { content: 'ok' } }] }])
    );

    const { streamChat } = await import('../services/anthropic.js');
    for await (const _ of streamChat('fitness', [{ role: 'user', content: 'hi' }])) {
      // consume
    }
    const sysPrompt = createMock.mock.calls[0]![0].messages[0].content;
    expect(sysPrompt).toMatch(/GROUNDING \(HARD RULE\)/);
    expect(sysPrompt).toMatch(/Do NOT invent/i);
  });

  it('skips tool path when location is unknown', async () => {
    createMock.mockResolvedValueOnce(
      asyncIter([{ choices: [{ delta: { content: 'hi' } }] }])
    );

    const { streamChat } = await import('../services/anthropic.js');
    const events: any[] = [];
    for await (const evt of streamChat('fitness', [{ role: 'user', content: 'hi' }])) {
      events.push(evt);
    }

    expect(createMock).toHaveBeenCalledOnce();
    const firstCallArgs = createMock.mock.calls[0]![0];
    expect(firstCallArgs.tools).toBeUndefined();
    expect(firstCallArgs.stream).toBe(true);
    expect(events).toEqual([{ type: 'token', text: 'hi' }]);
  });
});
