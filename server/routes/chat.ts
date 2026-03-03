import { Router, Request, Response } from 'express';
import { streamChat, ChatMessage } from '../services/openai.js';

const router = Router();

// POST /api/chat — streaming SSE endpoint
router.post('/', async (req: Request, res: Response) => {
  const { agentId, messages, styleProfile } = req.body as {
    agentId: string;
    messages: ChatMessage[];
    styleProfile?: object;
  };

  if (!agentId || !messages?.length) {
    res.status(400).json({ error: 'agentId and messages are required' });
    return;
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    for await (const token of streamChat(agentId, messages, styleProfile)) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err: any) {
    console.error('Stream error:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
