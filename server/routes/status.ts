import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/status — public provider health report.
 *
 * Returns only booleans (no secrets / no URLs) so the UI can display a
 * per-agent "Live / Links only / Offline" indicator.
 *
 * Public on purpose: it has to render before the user logs in, and the
 * response reveals nothing that an attacker couldn't already probe by
 * calling the feature routes.
 */
router.get('/', (_req: Request, res: Response) => {
  const env = process.env;

  const truthy = (v: string | undefined) =>
    typeof v === 'string' && v.trim().length > 0;

  const payload = {
    openai: truthy(env.OPENAI_API_KEY),
    googlePlaces: truthy(env.GOOGLE_PLACES_API_KEY),
    amadeus: truthy(env.AMADEUS_CLIENT_ID) && truthy(env.AMADEUS_CLIENT_SECRET),
    db: truthy(env.DATABASE_URL),
    redis: truthy(env.REDIS_URL),
    checkedAt: new Date().toISOString(),
  };

  res.json(payload);
});

export default router;
