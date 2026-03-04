import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runMigrations } from './db/migrate.js';
import chatRouter from './routes/chat.js';
import styleRouter from './routes/style.js';
import travelRouter from './routes/travel.js';

// Initialize SQLite + run migrations before anything else
runMigrations();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' })); // large limit for base64 images

// Extract userId from header (anonymous session)
app.use((req, _res, next) => {
  (req as any).userId = (req.headers['x-user-id'] as string) || 'anonymous';
  next();
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', agents: ['style', 'travel', 'fitness', 'lifestyle'] });
});

// Routes
app.use('/api/chat', chatRouter);
app.use('/api/style', styleRouter);
app.use('/api/travel', travelRouter);

// Global error handler — prevents raw stack traces from leaking to the client
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Payload too large. Please use a smaller image (max 10MB).' });
    return;
  }
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON in request body.' });
    return;
  }
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`GirlBot API server running on http://localhost:${PORT}`);
  console.log(`  POST /api/chat              — streaming chat (SSE)`);
  console.log(`  POST /api/style/analyze      — image analysis`);
  console.log(`  GET  /api/style/profile      — get style profile`);
  console.log(`  POST /api/style/profile      — save style profile`);
  console.log(`  POST /api/style/wardrobe     — upload wardrobe item`);
  console.log(`  GET  /api/style/wardrobe     — list wardrobe items`);
  console.log(`  DELETE /api/style/wardrobe/:id — remove wardrobe item`);
});
