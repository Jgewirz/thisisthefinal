import { Router, Request, Response } from 'express';
import { streamChat, ChatMessage } from '../services/anthropic.js';
import { saveChatMessage, getChatHistory, deleteChatMessages, deleteAllChatMessages } from '../services/db.js';
import { classifyDomain } from '../services/classifier.js';
import { idempotency } from '../middleware/idempotency.js';

const router = Router();

const VALID_AGENTS = new Set(['all', 'style', 'travel', 'fitness', 'lifestyle']);

/** Keep last N messages and strip base64 images from all but the most recent user message. */
function truncateMessages(messages: ChatMessage[], maxMessages = 20): ChatMessage[] {
  // Only keep the last N messages
  const recent = messages.slice(-maxMessages);

  // Find the last user message index (the one that may have a fresh image)
  let lastUserIdx = -1;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].role === 'user') { lastUserIdx = i; break; }
  }

  return recent.map((m, i) => {
    // Keep the most recent user message intact (may have an image the user just sent)
    if (i === lastUserIdx) return m;

    // For older messages, strip image_url content blocks to save tokens
    if (Array.isArray(m.content)) {
      const textOnly = m.content.filter((p: any) => p.type === 'text');
      if (textOnly.length === 0) return { ...m, content: '[image]' };
      return { ...m, content: textOnly };
    }
    return m;
  });
}

// POST /api/chat — streaming SSE endpoint
router.post('/', async (req: Request, res: Response) => {
  const { agentId, messages, styleProfile, location } = req.body as {
    agentId: string;
    messages: ChatMessage[];
    styleProfile?: object;
    location?: { lat: number; lng: number };
  };

  const userLocation =
    location &&
    typeof location.lat === 'number' &&
    typeof location.lng === 'number' &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng)
      ? { lat: location.lat, lng: location.lng }
      : undefined;

  // ── Input validation ──────────────────────────────────────
  if (!agentId || !messages?.length) {
    res.status(400).json({ error: 'agentId and messages are required' });
    return;
  }

  if (!VALID_AGENTS.has(agentId)) {
    res.status(400).json({ error: `Invalid agentId. Must be one of: ${[...VALID_AGENTS].join(', ')}` });
    return;
  }

  if (!Array.isArray(messages) || messages.some((m) => !m.role || !m.content)) {
    res.status(400).json({ error: 'Each message must have a role and content' });
    return;
  }

  // ── Abort handling ────────────────────────────────────────
  const abortController = new AbortController();
  let clientDisconnected = false;

  req.on('close', () => {
    clientDisconnected = true;
    abortController.abort();
  });

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let fullResponse = '';

  // If agentId is 'all', classify the domain from the latest user message
  let effectiveAgentId = agentId;
  if (agentId === 'all') {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const text = typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
        ? lastUserMsg.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ')
        : '';
    effectiveAgentId = await classifyDomain(text);
  }

  // Send the classified agent to the client for badge display
  res.write(`data: ${JSON.stringify({ classifiedAgent: effectiveAgentId })}\n\n`);

  try {
    // Strip base64 images from older messages to reduce token usage & cost
    const truncatedMessages = truncateMessages(messages);

    for await (const evt of streamChat(
      effectiveAgentId,
      truncatedMessages,
      styleProfile,
      abortController.signal,
      userLocation,
      req.user!.id
    )) {
      if (clientDisconnected) break;
      if (evt.type === 'token') {
        fullResponse += evt.text;
        res.write(`data: ${JSON.stringify({ token: evt.text })}\n\n`);
      } else if (evt.type === 'card') {
        res.write(`data: ${JSON.stringify({ card: evt.card })}\n\n`);
      }
    }

    if (!clientDisconnected) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    }

    // NOTE: Bot message persistence is handled client-side via POST /api/chat/messages
    // to avoid duplicate entries (client uses the same ID as the in-memory store).
  } catch (err: any) {
    if (clientDisconnected) return;
    console.error('Stream error:', err.stack || err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

// POST /api/chat/messages — save a single message (user or bot)
// Idempotent: clients may send an `Idempotency-Key` header to safely retry.
router.post('/messages', idempotency(), async (req: Request, res: Response) => {
  const { id, agentId, type, text, imageUrl, richCard } = req.body as {
    id: string;
    agentId: string;
    type: 'user' | 'bot';
    text: string;
    imageUrl?: string;
    richCard?: object;
  };

  if (!id || !agentId || !type) {
    res.status(400).json({ error: 'id, agentId, and type are required' });
    return;
  }

  try {
    const saved = await saveChatMessage({
      id,
user_id: req.user!.id,
    agent_id: agentId,
    type,
    text: text || '',
    image_url: imageUrl,
    rich_card: richCard,
  });

  res.json({ saved });
  } catch (err: any) {
    console.error('Save message error:', err.message);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// DELETE /api/chat/messages — clear conversation for an agent
router.delete('/messages', async (req: Request, res: Response) => {
  const agentId = req.query.agentId as string;
  const userId = req.user!.id;

  if (!agentId || agentId === 'all') {
    // Clear ALL conversations
    const deleted = await deleteAllChatMessages(userId);
    res.json({ deleted });
    return;
  }

  try {
    const deleted = await deleteChatMessages(agentId, userId);
    res.json({ deleted });
  } catch (err: any) {
    console.error('Delete messages error:', err.message);
    res.status(500).json({ error: 'Failed to delete messages' });
  }
});

// GET /api/chat/history — load persisted history
router.get('/history', async (req: Request, res: Response) => {
  const agentId = (req.query.agentId as string) || 'all';
  const userId = req.user!.id;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    const messages = await getChatHistory(agentId, userId, limit, offset);
    res.json({ messages });
  } catch (err: any) {
    console.error('Chat history error:', err.message);
    res.status(500).json({ error: 'Failed to load chat history' });
  }
});

export default router;
