/**
 * Convert unknown thrown values into stable loggable strings.
 *
 * Node/TS code sometimes throws non-Error values (strings, objects).
 * Logging `err.message` can therefore print an empty string and hide the
 * real cause.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === 'string') return err;
  if (err == null) return String(err);
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function errorStack(err: unknown): string | undefined {
  if (err instanceof Error) return err.stack || undefined;
  return undefined;
}

