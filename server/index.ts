import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import chatRouter from './routes/chat.js';
import styleRouter from './routes/style.js';
import authRouter from './routes/auth.js';
import { initDb } from './services/db.js';
import { authMiddleware } from './middleware/auth.js';

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

// ── Rate limiting ───────────────────────────────────────────
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 requests per minute per IP
  message: { error: 'Too many requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const imageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,             // 10 image analyses per minute per IP
  message: { error: 'Too many image requests. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', agents: ['style', 'travel', 'fitness', 'lifestyle'] });
});

// Auth routes (public)
app.use('/api/auth', authRouter);

// Protected routes — require JWT
app.use('/api/chat', authMiddleware, chatLimiter, chatRouter);
app.use('/api/style/analyze', authMiddleware, imageLimiter);
app.use('/api/style', authMiddleware, styleRouter);

// ── Global error handler ────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.stack || err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ───────────────────────────────────────────────────
async function start() {
  await initDb();

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
