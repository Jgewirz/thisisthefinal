import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runMigrations } from './db/migrate.js';
import authRouter from './routes/auth.js';
import googleAuthRouter from './routes/google-auth.js';
import chatRouter from './routes/chat.js';
import styleRouter from './routes/style.js';
import travelRouter from './routes/travel.js';
import fitnessRouter from './routes/fitness.js';
import locationRouter from './routes/location.js';
import calendarRouter from './routes/calendar.js';
import diningRouter from './routes/dining.js';
import lifestyleRouter from './routes/lifestyle.js';
import { readSessionUserId } from './services/auth.js';

function validateServerConfig() {
  const missingRequired = ['OPENAI_API_KEY'].filter((key) => !process.env[key]?.trim());
  if (missingRequired.length > 0) {
    throw new Error(`Missing required environment variables: ${missingRequired.join(', ')}`);
  }

  const optionalGroups = [
    {
      name: 'Amadeus travel search',
      keys: ['AMADEUS_CLIENT_ID', 'AMADEUS_CLIENT_SECRET'],
    },
    {
      name: 'Google Calendar integration',
      keys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_TOKEN_ENCRYPTION_KEY'],
    },
    {
      name: 'Cloudinary wardrobe uploads',
      keys: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
    },
  ];

  for (const group of optionalGroups) {
    const configuredKeys = group.keys.filter((key) => process.env[key]?.trim());
    if (configuredKeys.length > 0 && configuredKeys.length !== group.keys.length) {
      const missing = group.keys.filter((key) => !process.env[key]?.trim());
      console.warn(`[config] ${group.name} is partially configured. Missing: ${missing.join(', ')}`);
    }
  }

  const encryptionKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim();
  if (encryptionKey && !/^[a-fA-F0-9]{64}$/.test(encryptionKey)) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be a 64-character hex string');
  }

  if (!process.env.SESSION_SECRET?.trim()) {
    console.warn('[config] SESSION_SECRET is not set. Falling back to OPENAI_API_KEY for session signing.');
  }
}

validateServerConfig();

// Initialize SQLite + run migrations before anything else
runMigrations();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' })); // large limit for base64 images

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', agents: ['style', 'travel', 'fitness', 'lifestyle', 'calendar'] });
});

app.use('/api/auth', authRouter);
app.use('/api/auth', googleAuthRouter);

app.use('/api', (req, res, next) => {
  const userId = readSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  (req as any).userId = userId;
  next();
});

// Routes
app.use('/api/chat', chatRouter);
app.use('/api/style', styleRouter);
app.use('/api/travel', travelRouter);
app.use('/api/fitness', fitnessRouter);
app.use('/api/location', locationRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/dining', diningRouter);
app.use('/api/lifestyle', lifestyleRouter);

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
