import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  createUser,
  getUserByEmail,
  updateUserPassword,
} from '../services/db.js';
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  generateResetToken,
} from '../services/passwordReset.js';
import { generateToken } from '../middleware/auth.js';

const router = Router();

const MIN_PASSWORD_LENGTH = 6;

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function buildResetUrl(req: Request, token: string): string {
  const origin =
    (req.headers.origin as string | undefined) ||
    (process.env.PUBLIC_APP_URL && process.env.PUBLIC_APP_URL.trim()) ||
    '';
  return origin ? `${origin.replace(/\/$/, '')}/reset?token=${token}` : `/reset?token=${token}`;
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name } = req.body as {
    email: string;
    password: string;
    name?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  try {
    const existing = await getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser(email, passwordHash, name || email.split('@')[0]);

    if (!user) {
      res.status(500).json({ error: 'Failed to create account' });
      return;
    }

    const token = generateToken({ id: user.id, email: user.email, name: user.name });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err: any) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as {
    email: string;
    password: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken({ id: user.id, email: user.email, name: user.name });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err: any) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/forgot-password
// Always returns 200 regardless of whether the email exists — this prevents
// account-enumeration. In non-production we include `devResetUrl` in the
// response body so the flow is testable without an email provider.
router.post('/forgot-password', async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body?.email);
  const extras: Record<string, unknown> = {};

  if (email) {
    try {
      const user = await getUserByEmail(email);
      if (user) {
        const token = generateResetToken();
        const tokenId = await createPasswordResetToken(user.id, token);
        if (tokenId) {
          const resetUrl = buildResetUrl(req, token);
          console.log(
            `[password-reset] Issued token ${tokenId} for ${email}. URL: ${resetUrl}`
          );
          if (process.env.NODE_ENV !== 'production') {
            extras.devResetToken = token;
            extras.devResetUrl = resetUrl;
          }
        }
      }
    } catch (err: any) {
      console.error('forgot-password error:', err.message);
    }
  }

  res.json({ ok: true, ...extras });
});

// POST /api/auth/reset-password — consume a reset token and set a new password.
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = (req.body ?? {}) as {
    token?: unknown;
    newPassword?: unknown;
  };

  if (typeof token !== 'string' || !token) {
    res.status(400).json({ error: 'token is required' });
    return;
  }
  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({
      error: `newPassword must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
    return;
  }

  try {
    const record = await consumePasswordResetToken(token);
    if (!record) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }
    const hash = await bcrypt.hash(newPassword, 12);
    const ok = await updateUserPassword(record.user_id, hash);
    if (!ok) {
      res.status(500).json({ error: 'Failed to update password' });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    console.error('reset-password error:', err.message);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

export default router;
