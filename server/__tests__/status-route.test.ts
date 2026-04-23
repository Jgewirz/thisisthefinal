import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import statusRouter from '../routes/status.js';

interface InvokeResult {
  status: number;
  body: any;
}

async function invokeStatus(): Promise<InvokeResult> {
  const req: any = {
    method: 'GET',
    url: '/',
    originalUrl: '/api/status',
    baseUrl: '/api/status',
    path: '/',
    query: {},
    body: undefined,
    headers: {},
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

    (statusRouter as any).handle(req, res, (err?: unknown) => {
      if (err) reject(err);
      else resolve({ status: 404, body: { error: 'not found' } });
    });
  });
}

const ENV_KEYS = [
  'OPENAI_API_KEY',
  'GOOGLE_PLACES_API_KEY',
  'AMADEUS_CLIENT_ID',
  'AMADEUS_CLIENT_SECRET',
  'DATABASE_URL',
  'REDIS_URL',
];

describe('GET /api/status', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      originalEnv[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  it('returns all-false when no provider env is configured', async () => {
    const { status, body } = await invokeStatus();
    expect(status).toBe(200);
    expect(body).toMatchObject({
      openai: false,
      googlePlaces: false,
      amadeus: false,
      db: false,
      redis: false,
    });
    expect(typeof body.checkedAt).toBe('string');
  });

  it('reports openai + googlePlaces true when both env vars are set', async () => {
    process.env.OPENAI_API_KEY = 'sk-x';
    process.env.GOOGLE_PLACES_API_KEY = 'gkey';
    const { body } = await invokeStatus();
    expect(body.openai).toBe(true);
    expect(body.googlePlaces).toBe(true);
    expect(body.amadeus).toBe(false);
  });

  it('requires BOTH amadeus client id and secret for amadeus=true', async () => {
    process.env.AMADEUS_CLIENT_ID = 'cid';
    let { body } = await invokeStatus();
    expect(body.amadeus).toBe(false);

    process.env.AMADEUS_CLIENT_SECRET = 'sec';
    ({ body } = await invokeStatus());
    expect(body.amadeus).toBe(true);
  });

  it('treats blank/whitespace env values as missing', async () => {
    process.env.OPENAI_API_KEY = '   ';
    const { body } = await invokeStatus();
    expect(body.openai).toBe(false);
  });

  it('does not leak secret values in the response payload', async () => {
    process.env.OPENAI_API_KEY = 'sk-supersecret-xyz';
    process.env.AMADEUS_CLIENT_ID = 'cid-abc';
    process.env.AMADEUS_CLIENT_SECRET = 'sec-def';
    const { body } = await invokeStatus();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('sk-supersecret-xyz');
    expect(serialized).not.toContain('cid-abc');
    expect(serialized).not.toContain('sec-def');
  });

  it('reports db + redis independently from provider env', async () => {
    process.env.DATABASE_URL = 'postgres://x';
    const { body } = await invokeStatus();
    expect(body.db).toBe(true);
    expect(body.redis).toBe(false);
  });
});
