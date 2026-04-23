import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const svc = {
  saveItem: vi.fn(),
  listSavedItems: vi.fn(),
  deleteSavedItem: vi.fn(),
  deleteSavedItemByExternal: vi.fn(),
  SAVED_ITEM_KINDS: ['hotel', 'flight', 'place', 'studio', 'reminder'] as const,
};

vi.mock('../services/savedItems.js', () => svc);
vi.mock('../middleware/idempotency.js', () => ({
  idempotency: () => (_req: any, _res: any, next: any) => next(),
}));

interface InvokeResult {
  status: number;
  body: any;
}

async function invoke(
  method: string,
  url: string,
  body: any = undefined
): Promise<InvokeResult> {
  const { default: router } = await import('../routes/saved.js');
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
    params: {},
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
        res.statusCode = code;
        return res;
      },
      json(data: any) {
        payload = data;
        res.headersSent = true;
        resolve({ status, body: payload });
        return res;
      },
      send(data: any) {
        payload = data;
        res.headersSent = true;
        resolve({ status, body: payload });
        return res;
      },
      end() {
        res.headersSent = true;
        resolve({ status, body: payload });
        return res;
      },
    };

    (router as any).handle(req, res, (err?: unknown) => {
      if (err) reject(err);
      else resolve({ status: 404, body: { error: 'not found' } });
    });
  });
}

beforeEach(() => {
  for (const k of Object.keys(svc)) {
    const v = (svc as any)[k];
    if (typeof v?.mockReset === 'function') v.mockReset();
  }
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/saved', () => {
  it('returns items when no kind is provided', async () => {
    svc.listSavedItems.mockResolvedValue([{ id: '1', kind: 'hotel' }]);
    const { status, body } = await invoke('GET', '/');
    expect(status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(svc.listSavedItems).toHaveBeenCalledWith('u1', undefined);
  });

  it('filters by kind and scopes to user', async () => {
    svc.listSavedItems.mockResolvedValue([]);
    await invoke('GET', '/?kind=hotel');
    expect(svc.listSavedItems).toHaveBeenCalledWith('u1', 'hotel');
  });

  it('rejects invalid kind with 400', async () => {
    const { status, body } = await invoke('GET', '/?kind=airplane');
    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid kind/i);
    expect(svc.listSavedItems).not.toHaveBeenCalled();
  });
});

describe('POST /api/saved', () => {
  it('creates and returns 201 on valid body', async () => {
    svc.saveItem.mockResolvedValue({ id: 's1', kind: 'hotel', external_id: 'x' });
    const { status, body } = await invoke('POST', '/', {
      kind: 'hotel',
      externalId: 'x',
      data: { name: 'Grand' },
    });
    expect(status).toBe(201);
    expect(body.item.id).toBe('s1');
    expect(svc.saveItem).toHaveBeenCalledWith({
      userId: 'u1',
      kind: 'hotel',
      externalId: 'x',
      data: { name: 'Grand' },
    });
  });

  it('rejects missing / invalid kind', async () => {
    const { status } = await invoke('POST', '/', { externalId: 'x' });
    expect(status).toBe(400);
    expect(svc.saveItem).not.toHaveBeenCalled();
  });

  it('rejects missing externalId', async () => {
    const { status } = await invoke('POST', '/', { kind: 'hotel' });
    expect(status).toBe(400);
    expect(svc.saveItem).not.toHaveBeenCalled();
  });

  it('rejects non-object data', async () => {
    const { status } = await invoke('POST', '/', {
      kind: 'hotel',
      externalId: 'x',
      data: ['not', 'an', 'object'],
    });
    expect(status).toBe(400);
  });
});

describe('DELETE /api/saved', () => {
  it('deletes by id when :id is present', async () => {
    svc.deleteSavedItem.mockResolvedValue(true);
    // Simulate express populating req.params.id — the handler reads req.params.id.
    const { default: router } = await import('../routes/saved.js');
    const req: any = {
      method: 'DELETE',
      url: '/abc',
      originalUrl: '/abc',
      baseUrl: '',
      path: '/abc',
      params: { id: 'abc' },
      query: {},
      headers: {},
      user: { id: 'u1' },
      get: () => undefined,
      app: { get: () => undefined },
    };
    const out = await new Promise<InvokeResult>((resolve) => {
      const res: any = {
        statusCode: 200,
        setHeader() {},
        status(c: number) {
          res.statusCode = c;
          return res;
        },
        json(body: any) {
          resolve({ status: res.statusCode, body });
        },
      };
      (router as any).handle(req, res, () =>
        resolve({ status: 404, body: { error: 'not-found' } })
      );
    });
    expect(out.status).toBe(200);
    expect(out.body.ok).toBe(true);
    expect(svc.deleteSavedItem).toHaveBeenCalledWith('abc', 'u1');
  });

  it('deletes by (kind, externalId) query when no :id', async () => {
    svc.deleteSavedItemByExternal.mockResolvedValue(true);
    const { status, body } = await invoke('DELETE', '/?kind=hotel&externalId=x');
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(svc.deleteSavedItemByExternal).toHaveBeenCalledWith('u1', 'hotel', 'x');
  });

  it('returns 400 when query-delete is missing params', async () => {
    const { status } = await invoke('DELETE', '/?kind=hotel');
    expect(status).toBe(400);
    expect(svc.deleteSavedItemByExternal).not.toHaveBeenCalled();
  });

  it('returns 404 when nothing matched the natural key', async () => {
    svc.deleteSavedItemByExternal.mockResolvedValue(false);
    const { status } = await invoke('DELETE', '/?kind=hotel&externalId=missing');
    expect(status).toBe(404);
  });
});
