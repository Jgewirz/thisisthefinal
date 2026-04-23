/**
 * Express (and some typings) treat `req.params` values as `string | string[]`.
 * Route handlers that call DB helpers expecting a single `string` should use this.
 */
export function paramString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === 'string' ? v : v[0];
}
