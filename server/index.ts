import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import chatRouter from './routes/chat.js';
import styleRouter from './routes/style.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' })); // large limit for base64 images

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', agents: ['style', 'travel', 'fitness', 'lifestyle'] });
});

// Routes
app.use('/api/chat', chatRouter);
app.use('/api/style', styleRouter);

app.listen(PORT, () => {
  console.log(`GirlBot API server running on http://localhost:${PORT}`);
  console.log(`  POST /api/chat         — streaming chat (SSE)`);
  console.log(`  POST /api/style/analyze — image analysis`);
  console.log(`  GET  /api/style/profile — get style profile`);
  console.log(`  POST /api/style/profile — save style profile`);
});
