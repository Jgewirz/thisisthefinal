import './env.js';
import express from 'express';
import cors from 'cors';
import chatRouter from './routes/chat.js';
import styleRouter from './routes/style.js';
import authRouter from './routes/auth.js';
import remindersRouter from './routes/reminders.js';
import { initDb } from './services/db.js';
import { getKV } from './services/kv.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimit } from './middleware/rateLimit.js';
import { getJwtSecret } from './config/jwtSecret.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS — allow Vite dev origins + production ──────────────
const ALLOWED_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5174',
  'http://localhost:5174',
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (Postman, curl, SSE reconnect)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`CORS blocked: ${origin}`));
    }
  },
}));

app.use(express.json({ limit: '10mb' })); // large limit for base64 images

// ── Rate limiting (KV-backed, shared across replicas when REDIS_URL is set)
const chatLimiter = rateLimit({
  name: 'chat',
  windowMs: 60 * 1000,
  max: 30,
});

const imageLimiter = rateLimit({
  name: 'image',
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many image requests. Please wait.',
});

// Password-reset endpoints are attractive abuse targets (enumeration +
// brute force); limit tightly per IP/user.
const authResetLimiter = rateLimit({
  name: 'auth-reset',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many password-reset requests. Please wait.',
});

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', agents: ['style', 'travel', 'fitness', 'lifestyle'] });
});

// Auth routes (public) — rate-limit the reset endpoints specifically.
app.use('/api/auth/forgot-password', authResetLimiter);
app.use('/api/auth/reset-password', authResetLimiter);
app.use('/api/auth', authRouter);

// Protected routes — require JWT
app.use('/api/chat', authMiddleware, chatLimiter, chatRouter);
app.use('/api/style/analyze', authMiddleware, imageLimiter);
app.use('/api/style', authMiddleware, styleRouter);
app.use('/api/reminders', authMiddleware, chatLimiter, remindersRouter);

// ── Global error handler ────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.stack || err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ───────────────────────────────────────────────────
async function start() {
  // Fail fast in production if JWT_SECRET is missing / weak / a known default.
  getJwtSecret();

  await initDb();
  await getKV(); // initialize + log selected backend

  app.listen(PORT, () => {
    console.log(`GirlBot API server running on http://localhost:${PORT}`);
    console.log(`  POST /api/chat            — streaming chat (SSE)`);
    console.log(`  GET  /api/chat/history     — load chat history`);
    console.log(`  POST /api/style/analyze    — image analysis`);
    console.log(`  GET  /api/style/profile    — get style profile`);
    console.log(`  POST /api/style/profile    — save style profile`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
