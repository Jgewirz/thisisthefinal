import { Router, Request, Response } from 'express';
import { analyzeImage } from '../services/anthropic.js';
import { getStyleProfile, saveStyleProfile } from '../services/db.js';

const router = Router();

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

  // Validate image size (rough check: base64 is ~1.37x original size)
  const estimatedSizeBytes = (image.length * 3) / 4;
  const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB
  if (estimatedSizeBytes > MAX_IMAGE_SIZE) {
    res.status(413).json({ error: 'Image too large. Maximum size is 8MB.' });
    return;
  }

  try {
    const result = await analyzeImage(image, type);
    res.json({ result, type });
  } catch (err: any) {
    console.error('Image analysis error:', err.stack || err.message);
    res.status(500).json({ error: 'Image analysis failed' });
  }
});

// GET /api/style/profile — get style profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const profile = await getStyleProfile(userId);
    res.json({ profile });
  } catch (err: any) {
    console.error('Get profile error:', err.message);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// POST /api/style/profile — save style profile
router.post('/profile', async (req: Request, res: Response) => {
  const { profile } = req.body as {
    profile: object;
  };

  if (!profile) {
    res.status(400).json({ error: 'profile is required' });
    return;
  }

  try {
    const saved = await saveStyleProfile(profile, req.user!.id);
    res.json({ saved });
  } catch (err: any) {
    console.error('Save profile error:', err.message);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

export default router;
