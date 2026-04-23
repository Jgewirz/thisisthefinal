import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../stores/auth';
import {
  analyzeClothingPhoto,
  createWardrobeItem,
  deleteWardrobeItem,
  listWardrobe,
  updateWardrobeItem,
} from '../wardrobeApi';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  useAuthStore.setState({ token: 'tok-1', isAuthenticated: true } as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('listWardrobe', () => {
  it('sends Authorization and parses the { items } envelope', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [{ id: 'w1', category: 'top' }] }), { status: 200 })
    );
    const out = await listWardrobe('top');
    expect(out).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/style/wardrobe?category=top');
    expect((init.headers as any).Authorization).toBe('Bearer tok-1');
  });

  it('omits category param when not provided', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    await listWardrobe();
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/style/wardrobe');
  });

  it('returns [] when the server is unhappy', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }));
    expect(await listWardrobe()).toEqual([]);
  });
});

describe('createWardrobeItem', () => {
  it('uses a stable Idempotency-Key when a clientId is provided', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ item: { id: 'w1', category: 'top' } }), { status: 201 })
    );
    const out = await createWardrobeItem(
      { category: 'top', color: 'black' },
      'photo-42'
    );
    expect(out?.id).toBe('w1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/style/wardrobe');
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('wardrobe:create:photo-42');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ category: 'top', color: 'black' });
  });

  it('falls back to a random Idempotency-Key when no clientId', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ item: { id: 'w2', category: 'top' } }), { status: 201 })
    );
    await createWardrobeItem({ category: 'top' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toMatch(/^wardrobe:create:/);
    expect(headers['Idempotency-Key'].length).toBeGreaterThan('wardrobe:create:'.length);
  });

  it('returns null on non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 400 }));
    expect(await createWardrobeItem({ category: 'top' })).toBeNull();
  });
});

describe('updateWardrobeItem', () => {
  it('PATCHes /api/style/wardrobe/:id with the JSON patch', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ item: { id: 'w1', color: 'red' } }), { status: 200 })
    );
    const out = await updateWardrobeItem('w1', { color: 'red' });
    expect(out?.color).toBe('red');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/style/wardrobe/w1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ color: 'red' });
  });

  it('returns null on 404 (so the store can roll back)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }));
    expect(await updateWardrobeItem('missing', { color: 'red' })).toBeNull();
  });
});

describe('deleteWardrobeItem', () => {
  it('hits DELETE and returns true on 2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    expect(await deleteWardrobeItem('w1')).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/style/wardrobe/w1');
    expect(init.method).toBe('DELETE');
  });

  it('encodes ids with special chars', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await deleteWardrobeItem('a/b?c');
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/style/wardrobe/a%2Fb%3Fc');
  });

  it('returns false on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }));
    expect(await deleteWardrobeItem('missing')).toBe(false);
  });
});

describe('analyzeClothingPhoto', () => {
  it('posts with type=clothing_tag and returns the result', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ result: { category: 'top', color: 'black' } }),
        { status: 200 }
      )
    );
    const out = await analyzeClothingPhoto('data:image/png;base64,AAA');
    expect(out).toEqual({ category: 'top', color: 'black' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/style/analyze');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.type).toBe('clothing_tag');
    expect(body.image).toBe('data:image/png;base64,AAA');
  });

  it('returns null on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 500 }));
    expect(await analyzeClothingPhoto('x')).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    expect(await analyzeClothingPhoto('x')).toBeNull();
  });
});
