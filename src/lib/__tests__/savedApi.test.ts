import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../stores/auth';
import { listSavedItems, saveItem, unsaveItem } from '../savedApi';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  useAuthStore.setState({ token: 'tok-1', isAuthenticated: true } as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('listSavedItems', () => {
  it('sends Authorization and parses the { items } envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [{ id: '1', kind: 'hotel' }] }), { status: 200 })
    );
    const out = await listSavedItems('hotel');
    expect(out).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/saved?kind=hotel');
    expect((init.headers as any).Authorization).toBe('Bearer tok-1');
  });

  it('returns [] when the server is unhappy', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }));
    expect(await listSavedItems()).toEqual([]);
  });
});

describe('saveItem', () => {
  it('uses a deterministic Idempotency-Key per (kind, externalId)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ item: { id: 's1', kind: 'hotel', external_id: 'h-42' } }), {
        status: 201,
      })
    );
    const out = await saveItem('hotel', 'h-42', { name: 'Grand' });
    expect(out?.id).toBe('s1');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('saved:hotel:h-42');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({
      kind: 'hotel',
      externalId: 'h-42',
      data: { name: 'Grand' },
    });
  });

  it('returns null on non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('oops', { status: 500 }));
    expect(await saveItem('hotel', 'x', {})).toBeNull();
  });
});

describe('unsaveItem', () => {
  it('hits DELETE /api/saved with kind+externalId', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const ok = await unsaveItem('hotel', 'h-42');
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/saved?kind=hotel&externalId=h-42');
    expect(init.method).toBe('DELETE');
  });

  it('returns false on 404/network failure', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }));
    expect(await unsaveItem('hotel', 'x')).toBe(false);
  });
});
