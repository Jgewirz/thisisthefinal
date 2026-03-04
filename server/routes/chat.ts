import { Router, Request, Response } from 'express';
import { streamChat, ChatMessage } from '../services/openai.js';
import { getAgentConfig } from '../config/agents.js';

const router = Router();

/**
 * Strip image_url content parts from messages for non-vision agents.
 * Prevents OpenAI 400 errors when images are sent to travel/fitness/lifestyle.
 */
function sanitizeMessagesForAgent(agentId: string, messages: ChatMessage[]): ChatMessage[] {
  const config = getAgentConfig(agentId);
  if (config.supportsVision) return messages;

  return messages.map((m) => {
    if (Array.isArray(m.content)) {
      // Keep only text parts, drop image_url parts
      const textParts = m.content.filter((p) => p.type === 'text');
      if (textParts.length === 0) {
        return { ...m, content: '(Image sent — this agent cannot view images)' };
      }
      const combinedText = textParts.map((p) => p.text ?? '').join('\n');
      return { ...m, content: combinedText };
    }
    return m;
  });
}

/** Sanitize OpenAI error messages before sending to client */
function sanitizeError(message: string): string {
  if (message.includes('unsupported image') || message.includes('Could not process image')) {
    return 'That image format isn\'t supported. Please try a JPEG or PNG photo!';
  }
  if (message.includes('rate limit') || message.includes('Rate limit')) {
    return 'I\'m getting a lot of requests right now. Please wait a moment and try again!';
  }
  if (message.includes('context_length') || message.includes('maximum context')) {
    return 'This conversation is getting long! Try starting a new one.';
  }
  if (message.includes('api_key') || message.includes('authentication')) {
    return 'There\'s a configuration issue on the server. Please contact support.';
  }
  return 'Sorry, something went wrong. Please try again!';
}

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

  // Strip images from messages for non-vision agents
  const cleanMessages = sanitizeMessagesForAgent(agentId, messages);

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    for await (const token of streamChat(agentId, cleanMessages, styleProfile)) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err: any) {
    console.error('Stream error:', err.message);
    res.write(`data: ${JSON.stringify({ error: sanitizeError(err.message ?? '') })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
