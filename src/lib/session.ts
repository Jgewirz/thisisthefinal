const SESSION_KEY = 'girlbot-user-id';

export function getUserId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function ensureSession(): Promise<void> {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    throw new Error('Failed to initialize authenticated session');
  }
}

export function loginWithGoogle(): void {
  window.location.href = '/api/auth/google';
}
