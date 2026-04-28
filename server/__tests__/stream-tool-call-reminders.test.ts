import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();
vi.mock('openai', () => {
  class FakeOpenAI {
    chat = { completions: { create: createMock } };
    constructor(_: unknown) {}
  }
  return { default: FakeOpenAI };
});

const createReminderMock = vi.fn();
vi.mock('../services/reminders.js', () => ({
  createReminder: createReminderMock,
  listReminders: vi.fn(),
}));

// Stub out other tool services so their imports resolve cleanly.
vi.mock('../services/places.js', () => ({
  searchPlaces: vi.fn(),
  buildSearchTextBody: () => ({}),
}));
vi.mock('../services/amadeus.js', () => ({
  searchFlights: vi.fn(),
  buildGoogleFlightsUrl: (p: any) => `https://x/${p.origin}-${p.destination}`,
}));

async function* asyncIter<T>(items: T[]) {
  for (const i of items) yield i;
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
  createMock.mockReset();
  createReminderMock.mockReset();
});

describe('streamChat — create_reminder tool calling', () => {
  it('invokes create_reminder on lifestyle agent and emits a reminder card', async () => {
    const reminder = {
      id: 'r1',
      user_id: 'u1',
      agent_id: 'lifestyle',
      title: 'Drink water',
      notes: null,
      due_at: '2026-05-01T12:00:00.000Z',
      notify_via: 'in_app',
      status: 'pending',
      created_at: '2026-04-20T00:00:00.000Z',
      fired_at: null,
    };
    createReminderMock.mockResolvedValue(reminder);

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'tc_r1',
                type: 'function',
                function: {
                  name: 'create_reminder',
                  arguments: JSON.stringify({
                    title: 'Drink water',
                    dueAt: '2026-05-01T12:00:00.000Z',
                  }),
                },
              },
            ],
          },
        },
      ],
    });
    createMock.mockResolvedValueOnce(
      asyncIter([{ choices: [{ delta: { content: 'Got it — reminder set.' } }] }])
    );

    const { streamChat } = await import('../services/anthropic.js');
    const events: any[] = [];
    for await (const evt of streamChat(
      'lifestyle',
      [{ role: 'user', content: 'remind me to drink water at noon May 1 2026' }],
      undefined,
      undefined,
      undefined,
      'u1'
    )) {
      events.push(evt);
    }

    expect(createReminderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        agentId: 'lifestyle',
        title: 'Drink water',
        dueAt: '2026-05-01T12:00:00.000Z',
      })
    );

    const card = events.find((e) => e.type === 'card');
    expect(card?.card.type).toBe('reminder');
    expect(card?.card.data.id).toBe('r1');

    const tokens = events.filter((e) => e.type === 'token').map((e) => e.text);
    expect(tokens.join('')).toContain('reminder set');

    const firstCallArgs = createMock.mock.calls[0]![0];
    const toolNames = (firstCallArgs.tools || []).map((t: any) => t.function.name);
    expect(toolNames).toContain('create_reminder');

    // Grounding system message must confirm the reminder and include the title.
    const second = createMock.mock.calls[1]![0].messages;
    const sysMsgs = second.filter((m: any) => m.role === 'system');
    expect(
      sysMsgs.some((m: any) => /reminder saved|scheduled/i.test(m.content ?? ''))
    ).toBe(true);
  });

  it('falls back gracefully when createReminder throws (e.g. past date)', async () => {
    createReminderMock.mockRejectedValue(new Error('dueAt must be in the future'));

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'tc_r2',
                type: 'function',
                function: {
                  name: 'create_reminder',
                  arguments: JSON.stringify({
                    title: 'x',
                    dueAt: '1999-01-01T00:00:00.000Z',
                  }),
                },
              },
            ],
          },
        },
      ],
    });
    createMock.mockResolvedValueOnce(
      asyncIter([{ choices: [{ delta: { content: 'Please give a future time.' } }] }])
    );

    const { streamChat } = await import('../services/anthropic.js');
    const events: any[] = [];
    for await (const evt of streamChat(
      'lifestyle',
      [{ role: 'user', content: 'remind me yesterday' }],
      undefined,
      undefined,
      undefined,
      'u1'
    )) {
      events.push(evt);
    }

    // No card should be emitted when creation fails.
    expect(events.some((e) => e.type === 'card')).toBe(false);

    const second = createMock.mock.calls[1]![0].messages;
    const toolMsg = second.find((m: any) => m.role === 'tool');
    expect(JSON.parse(toolMsg.content)).toMatchObject({ ok: false });

    const sysMsgs = second.filter((m: any) => m.role === 'system');
    expect(
      sysMsgs.some((m: any) => /past|future time|create_reminder failed/i.test(m.content ?? ''))
    ).toBe(true);
  });

  it('does NOT register create_reminder when no userId is provided', async () => {
    createMock.mockResolvedValueOnce(
      asyncIter([{ choices: [{ delta: { content: 'hi' } }] }])
    );

    const { streamChat } = await import('../services/anthropic.js');
    for await (const _ of streamChat(
      'lifestyle',
      [{ role: 'user', content: 'hi' }],
      undefined,
      undefined,
      undefined
      // no userId
    )) {
      // consume
    }

    const firstCallArgs = createMock.mock.calls[0]![0];
    // Without userId, reminder tools should not be enabled.
    const toolNames = (firstCallArgs.tools || []).map((t: any) => t.function.name);
    expect(toolNames).not.toContain('create_reminder');
    expect(toolNames).not.toContain('list_reminders');
  });
});

describe('streamChat — list_reminders tool calling', () => {
  it('invokes list_reminders on lifestyle agent and summarizes the results', async () => {
    const { listReminders } = await import('../services/reminders.js');
    (listReminders as any).mockResolvedValue([
      {
        id: 'r1',
        user_id: 'u1',
        agent_id: 'lifestyle',
        title: 'Drink water',
        notes: null,
        due_at: '2026-05-01T12:00:00.000Z',
        notify_via: 'in_app',
        status: 'pending',
        created_at: '2026-04-20T00:00:00.000Z',
        fired_at: null,
      },
    ]);

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'tc_lr1',
                type: 'function',
                function: {
                  name: 'list_reminders',
                  arguments: JSON.stringify({ status: 'pending', limit: 10 }),
                },
              },
            ],
          },
        },
      ],
    });
    createMock.mockResolvedValueOnce(
      asyncIter([{ choices: [{ delta: { content: 'You have 1 pending reminder.' } }] }])
    );

    const { streamChat } = await import('../services/anthropic.js');
    const events: any[] = [];
    for await (const evt of streamChat(
      'lifestyle',
      [{ role: 'user', content: 'what reminders do i have?' }],
      undefined,
      undefined,
      undefined,
      'u1'
    )) {
      events.push(evt);
    }

    expect((listReminders as any)).toHaveBeenCalledWith('u1', expect.objectContaining({ status: 'pending', limit: 10 }));

    const firstCallArgs = createMock.mock.calls[0]![0];
    const toolNames = (firstCallArgs.tools || []).map((t: any) => t.function.name);
    expect(toolNames).toContain('list_reminders');

    const second = createMock.mock.calls[1]![0].messages;
    const toolMsg = second.find((m: any) => m.role === 'tool');
    expect(JSON.parse(toolMsg.content)).toMatchObject({ ok: true, count: 1 });
  });
});
