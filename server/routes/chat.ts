import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { streamChat, ChatMessage } from '../services/openai.js';
import { getAgentConfig } from '../config/agents.js';
import { getDb } from '../db/sqlite.js';

const router = Router();
const VALID_AGENT_IDS = new Set(['all', 'style', 'travel', 'fitness', 'lifestyle']);

type StoredMessage = {
  id: string;
  type: 'user' | 'bot';
  text: string;
  timestamp: string;
  agentId: string;
  imageUrl?: string;
  richCard?: { type: string; data: any };
};

function ensureUser(userId: string) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(userId);
}

function serializeMessageRow(row: any): StoredMessage {
  return {
    id: row.id,
    type: row.message_type,
    text: row.text,
    timestamp: row.created_at,
    agentId: row.agent_id,
    imageUrl: row.image_url || undefined,
    richCard: row.rich_card_type
      ? {
          type: row.rich_card_type,
          data: JSON.parse(row.rich_card_data || 'null'),
        }
      : undefined,
  };
}

router.get('/history', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const db = getDb();
    const rows = db.prepare(
      `SELECT id, agent_id, message_type, text, image_url, rich_card_type, rich_card_data, created_at
       FROM chat_messages
       WHERE user_id = ?
       ORDER BY agent_id ASC, message_order ASC`
    ).all(userId) as any[];

    const history: Record<string, StoredMessage[]> = {
      all: [],
      style: [],
      travel: [],
      fitness: [],
      lifestyle: [],
    };

    for (const row of rows) {
      if (!history[row.agent_id]) {
        history[row.agent_id] = [];
      }
      history[row.agent_id].push(serializeMessageRow(row));
    }

    res.json({ history });
  } catch (err: any) {
    console.error('Chat history load error:', err.message);
    res.status(500).json({ error: 'Failed to load chat history' });
  }
});

router.put('/history/:agentId', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { messages } = req.body as { messages?: StoredMessage[] };

  if (!VALID_AGENT_IDS.has(agentId)) {
    res.status(400).json({ error: 'Invalid agentId' });
    return;
  }

  if (!Array.isArray(messages)) {
    res.status(400).json({ error: 'messages must be an array' });
    return;
  }

  try {
    const userId = (req as any).userId as string;
    ensureUser(userId);

    const db = getDb();
    const replaceHistory = db.transaction((historyMessages: StoredMessage[]) => {
      db.prepare('DELETE FROM chat_messages WHERE user_id = ? AND agent_id = ?').run(userId, agentId);

      const insert = db.prepare(
        `INSERT INTO chat_messages
          (id, user_id, agent_id, message_type, text, image_url, rich_card_type, rich_card_data, created_at, message_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      historyMessages.forEach((message, index) => {
        insert.run(
          message.id || crypto.randomUUID(),
          userId,
          agentId,
          message.type,
          message.text || '',
          message.imageUrl || null,
          message.richCard?.type || null,
          message.richCard ? JSON.stringify(message.richCard.data ?? null) : null,
          message.timestamp || new Date().toISOString(),
          index
        );
      });
    });

    const filteredMessages = messages.filter((message) => message && (message.text || message.imageUrl || message.richCard));
    replaceHistory(filteredMessages);
    res.json({ saved: true, count: filteredMessages.length });
  } catch (err: any) {
    console.error('Chat history save error:', err.message);
    res.status(500).json({ error: 'Failed to save chat history' });
  }
});

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
  const { agentId, messages, styleProfile, travelProfile, fitnessProfile, userLocation } = req.body as {
    agentId: string;
    messages: ChatMessage[];
    styleProfile?: object;
    travelProfile?: object;
    fitnessProfile?: object;
    userLocation?: object;
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
    for await (const token of streamChat(agentId, cleanMessages, styleProfile, travelProfile, fitnessProfile, userLocation)) {
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
