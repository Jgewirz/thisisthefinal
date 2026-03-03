import { Router, Request, Response } from 'express';
import { analyzeImage } from '../services/openai.js';

const router = Router();

// In-memory profile store (replace with Redis later)
const profiles = new Map<string, object>();

// POST /api/style/analyze — image analysis
router.post('/analyze', async (req: Request, res: Response) => {
  const { image, type } = req.body as {
    image: string; // base64 data URL
    type: 'skin_tone' | 'outfit_rating' | 'clothing_tag';
  };

  if (!image || !type) {
    res.status(400).json({ error: 'image and type are required' });
    return;
  }

  const validTypes = ['skin_tone', 'outfit_rating', 'clothing_tag'];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    return;
  }

  try {
    const result = await analyzeImage(image, type);
    res.json({ result, type });
  } catch (err: any) {
    console.error('Image analysis error:', err.message);
    res.status(500).json({ error: 'Image analysis failed' });
  }
});

// GET /api/style/profile — get style profile
router.get('/profile', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'default';
  const profile = profiles.get(userId) || null;
  res.json({ profile });
});

// POST /api/style/profile — save style profile
router.post('/profile', (req: Request, res: Response) => {
  const { userId = 'default', profile } = req.body as {
    userId?: string;
    profile: object;
  };

  if (!profile) {
    res.status(400).json({ error: 'profile is required' });
    return;
  }

  profiles.set(userId, profile);
  res.json({ saved: true });
});

export default router;
