import dotenv from 'dotenv';

/**
 * Loads `.env` into process.env for the API server.
 *
 * Must be imported FIRST in any entrypoint (see server/index.ts) because
 * ESM evaluates imported modules in the order they appear, and this module's
 * side effect (`dotenv.config`) needs to run before any downstream module
 * (e.g. anthropic.ts) reads `process.env`.
 *
 * `override: true` prevents a stale shell-exported empty value (e.g.
 * `AMADEUS_CLIENT_ID=`) from masking the real value in `.env`.
 */
dotenv.config({ override: true });
