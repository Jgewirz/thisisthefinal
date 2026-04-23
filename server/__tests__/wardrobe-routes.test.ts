import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';

const svc = {
  createWardrobeItem: vi.fn(),
  listWardrobeItems: vi.fn(),
  updateWardrobeItem: vi.fn(),
  deleteWardrobeItem: vi.fn(),
  // Constants must be re-exported from the mock so the route module imports work.
  WARDROBE_CATEGORIES: ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory', 'activewear'],
};

vi.mock('../services/wardrobe.js', () => svc);
vi.mock('../middleware/idempotency.js', () => ({
  idempotency: () => (_req: any, _res: any, next: any) => next(),
}));

beforeEach(() => {
  svc.createWardrobeItem.mockReset();
  svc.listWardrobeItems.mockReset();
  svc.updateWardrobeItem.mockReset();
  svc.deleteWardrobeItem.mockReset();
});

interface InvokeResult {
  status: number;
  body: any;
}

async function invoke(
  method: string,
  url: string,
  body: any = undefined
): Promise<InvokeResult> {
  const { default: router } = await import('../routes/wardrobe.js');
  const [pathname, search] = url.split('?');
  const query: Record<string, string> = {};
  if (search) {
    for (const part of search.split('&')) {
      const [k, v = ''] = part.split('=');
      query[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }
  const req: any = {
    method,
    url,
    originalUrl: url,
    baseUrl: '',
    path: pathname,
    query,
    body,
    headers: { 'content-type': 'application/json' },
    user: { id: 'u1', email: 'u1@x.com' },
    get: (h: string) => req.headers[h.toLowerCase()],
    app: { get: () => undefined },
  };

  return new Promise<InvokeResult>((resolve, reject) => {
    let status = 200;
    let payload: any;
    const res: any = {
      statusCode: 200,
      headersSent: false,
      setHeader() {},
      getHeader() {},
      removeHeader() {},
      status(code: number) {
        status = code;
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        payload = data;
        resolve({ status, body: data });
        return this;
      },
      end(data?: any) {
        if (payload === undefined) payload = data;
        resolve({ status, body: payload });
        return this;
      },
    };
    router.handle(req as IncomingMessage, res as ServerResponse, (err?: any) => {
      if (err) return reject(err);
      resolve({ status: 404, body: { error: 'not matched' } });
    });
  });
}

describe('GET /api/style/wardrobe', () => {
  it('returns items for the authenticated user', async () => {
    svc.listWardrobeItems.mockResolvedValueOnce([{ id: 'w1' }]);
    const res = await invoke('GET', '/');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([{ id: 'w1' }]);
    expect(svc.listWardrobeItems).toHaveBeenCalledWith('u1', { category: undefined });
  });

  it('rejects invalid category query param with 400', async () => {
    const res = await invoke('GET', '/?category=spaceship');
    expect(res.status).toBe(400);
    expect(svc.listWardrobeItems).not.toHaveBeenCalled();
  });

  it('passes valid category through', async () => {
    svc.listWardrobeItems.mockResolvedValueOnce([]);
    const res = await invoke('GET', '/?category=shoes');
    expect(res.status).toBe(200);
    expect(svc.listWardrobeItems).toHaveBeenCalledWith('u1', { category: 'shoes' });
  });
});

describe('POST /api/style/wardrobe', () => {
  it('requires a category', async () => {
    const res = await invoke('POST', '/', { color: 'red' });
    expect(res.status).toBe(400);
    expect(svc.createWardrobeItem).not.toHaveBeenCalled();
  });

  it('creates an item and returns 201', async () => {
    svc.createWardrobeItem.mockResolvedValueOnce({ id: 'w1', category: 'top' });
    const res = await invoke('POST', '/', { category: 'top', color: 'black' });
    expect(res.status).toBe(201);
    expect(res.body.item).toEqual({ id: 'w1', category: 'top' });
    expect(svc.createWardrobeItem).toHaveBeenCalledOnce();
    expect(svc.createWardrobeItem.mock.calls[0][0].userId).toBe('u1');
  });

  it('maps validation errors from the service to 400', async () => {
    svc.createWardrobeItem.mockRejectedValueOnce(new Error('invalid season: monsoon'));
    const res = await invoke('POST', '/', { category: 'top', seasons: ['monsoon'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid season/);
  });

  it('maps unexpected errors to 500', async () => {
    svc.createWardrobeItem.mockRejectedValueOnce(new Error('db exploded'));
    const res = await invoke('POST', '/', { category: 'top' });
    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/style/wardrobe/:id', () => {
  it('404s when the item does not exist / wrong owner', async () => {
    svc.updateWardrobeItem.mockResolvedValueOnce(null);
    const res = await invoke('PATCH', '/w-missing', { color: 'red' });
    expect(res.status).toBe(404);
  });

  it('returns the updated item', async () => {
    svc.updateWardrobeItem.mockResolvedValueOnce({ id: 'w1', color: 'red' });
    const res = await invoke('PATCH', '/w1', { color: 'red' });
    expect(res.status).toBe(200);
    expect(res.body.item).toEqual({ id: 'w1', color: 'red' });
    expect(svc.updateWardrobeItem).toHaveBeenCalledWith('w1', 'u1', { color: 'red' });
  });
});

describe('DELETE /api/style/wardrobe/:id', () => {
  it('returns 404 when nothing matched', async () => {
    svc.deleteWardrobeItem.mockResolvedValueOnce(false);
    const res = await invoke('DELETE', '/w-missing');
    expect(res.status).toBe(404);
  });

  it('deletes owner-scoped', async () => {
    svc.deleteWardrobeItem.mockResolvedValueOnce(true);
    const res = await invoke('DELETE', '/w1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(svc.deleteWardrobeItem).toHaveBeenCalledWith('w1', 'u1');
  });
});
