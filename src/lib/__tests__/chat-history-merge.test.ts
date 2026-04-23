import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useChatStore } from '../../stores/chat';
import { useAuthStore } from '../../stores/auth';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Message } from '../../app/types';

const here = dirname(fileURLToPath(import.meta.url));
const apiSrc = readFileSync(resolve(here, '..', 'api.ts'), 'utf8');

describe('loadChatHistory — merge with live messages', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    useAuthStore.setState({
      token: 'test-token',
      user: { id: 'u1', email: 'u@example.com', name: 'U' },
      isAuthenticated: true,
    } as any);

    useChatStore.setState((s) => ({
      agents: {
        ...s.agents,
        travel: { ...s.agents.travel, messages: [], historyLoaded: false, isStreaming: false, activity: null },
      },
    }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('does not clobber an optimistic user message if history loads after it', async () => {
    const optimistic: Message = {
      id: 'm_live',
      type: 'user',
      text: 'find hotels in Paris',
      timestamp: new Date('2026-04-23T10:00:00.000Z'),
      agentId: 'travel',
    };
    useChatStore.getState().addMessage('travel', optimistic);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        messages: [
          {
            id: 'm_hist',
            type: 'bot',
            text: 'Sure.',
            created_at: '2026-04-23T09:59:00.000Z',
            agent_id: 'travel',
            image_url: null,
            rich_card: null,
          },
        ],
      }),
    } as any);

    const { loadChatHistory } = await import('../api');
    await loadChatHistory('travel');

    const msgs = useChatStore.getState().getMessages('travel');
    expect(msgs.map((m) => m.id)).toEqual(['m_hist', 'm_live']);
    expect(msgs.find((m) => m.id === 'm_live')?.text).toBe('find hotels in Paris');
  });

  it('concurrent calls for the same agent only run one fetch (in-progress guard)', async () => {
    let resolveFirst!: () => void;
    const firstFetch = new Promise<void>((res) => { resolveFirst = res; });

    let fetchCallCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      fetchCallCount++;
      return firstFetch.then(() => ({
        ok: true,
        status: 200,
        json: async () => ({ messages: [] }),
      }));
    }) as any;

    const { loadChatHistory } = await import('../api');
    // Fire two concurrent loads before the first one resolves
    const p1 = loadChatHistory('travel');
    const p2 = loadChatHistory('travel');
    resolveFirst();
    await Promise.all([p1, p2]);

    expect(fetchCallCount).toBe(1);
  });
});

describe('readStream — returns classifiedAgent', () => {
  it('readStream function is declared to return Promise<AgentId>', () => {
    expect(apiSrc).toMatch(/async function readStream\(res: Response, agentId: AgentId\): Promise<AgentId>/);
  });

  it('classifiedAgent variable is initialised to agentId and updated on classifiedAgent SSE event', () => {
    expect(apiSrc).toMatch(/let classifiedAgent: AgentId = agentId/);
    expect(apiSrc).toMatch(/classifiedAgent = data\.classifiedAgent as AgentId/);
    expect(apiSrc).toMatch(/return classifiedAgent/);
  });
});

describe('sendMessage — cross-tab user message persistence', () => {
  it('persists user message under classified agent when All tab gets classified', () => {
    // Structural check: the cross-population block must be present
    expect(apiSrc).toContain("if (agentId === 'all' && classifiedAgent !== 'all')");
    expect(apiSrc).toContain('const crossUserMsg: Message = { ...userMsg, agentId: classifiedAgent }');
    expect(apiSrc).toContain('store.addMessage(classifiedAgent, crossUserMsg)');
    expect(apiSrc).toContain('await persistMessage(crossUserMsg)');
  });

  it('deduplicates before adding cross message to specialist store', () => {
    expect(apiSrc).toContain('!inSpecialist.some((m) => m.id === userMsg.id)');
  });
});

