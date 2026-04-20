import type { AgentId, Message, RichCard } from '../app/types';
import { useChatStore } from '../stores/chat';
import { useStyleStore } from '../stores/style';
import { useAuthStore } from '../stores/auth';
import { useLocationStore } from '../stores/location';

// ── Authenticated fetch wrapper ─────────────────────────────

/** Fetch with JWT auth header. Auto-logout on 401. */
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { token } = useAuthStore.getState();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  return res;
}

/**
 * Convert store messages to the shape the API expects.
 * Messages with images become multimodal content arrays for GPT-4o vision.
 */
function toApiMessages(messages: Message[]) {
  return messages.map((m) => {
    // If this message has an image, build a multimodal content array
    if (m.imageUrl) {
      const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
      if (m.text) {
        parts.push({ type: 'text', text: m.text });
      }
      parts.push({ type: 'image_url', image_url: { url: m.imageUrl } });
      return {
        role: m.type === 'user' ? ('user' as const) : ('assistant' as const),
        content: parts,
      };
    }

    return {
      role: m.type === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.text,
    };
  });
}

/** Read an SSE stream and push tokens into the store */
async function readStream(res: Response, agentId: AgentId) {
  const store = useChatStore.getState();
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.classifiedAgent) {
          // Update the bot message badge to show the classified specialist
          store.updateLastBotAgentId(agentId, data.classifiedAgent as AgentId);
        }
        if (data.token) {
          store.appendToLastBot(agentId, data.token);
        }
        if (data.card && typeof data.card === 'object' && data.card.type) {
          store.setRichCardOnLastBot(agentId, data.card);
        }
        if (data.error) {
          store.appendToLastBot(agentId, `\n\n[Error: ${data.error}]`);
        }
      } catch {
        // skip malformed JSON
      }
    }
  }
}

/**
 * Resize a base64 image to a small thumbnail for DB storage.
 * Full images are 2-5 MB; thumbnails are ~10-20 KB.
 */
function createThumbnail(dataUrl: string, maxWidth = 200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.5));
    };
    img.onerror = () => resolve(dataUrl); // fallback to original
    img.src = dataUrl;
  });
}

/**
 * Persist a message to the database (fire-and-forget).
 * If the message has a base64 image, shrink it to a thumbnail first.
 */
async function persistMessage(msg: Message) {
  let imageUrl = msg.imageUrl;
  if (imageUrl?.startsWith('data:')) {
    imageUrl = await createThumbnail(imageUrl);
  }
  authFetch('/api/chat/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Message id is stable per client-side message, so reuse it as the
      // idempotency key. Safe on retry / double-clicks / HMR re-renders.
      'Idempotency-Key': `msg:${msg.id}`,
    },
    body: JSON.stringify({
      id: msg.id,
      agentId: msg.agentId,
      type: msg.type,
      text: msg.text,
      imageUrl,
      richCard: msg.richCard,
    }),
  }).catch(() => {}); // silent fail — local store is primary
}

/**
 * Load chat history from the database for a given agent.
 */
export async function loadChatHistory(agentId: AgentId): Promise<void> {
  const store = useChatStore.getState();
  if (store.agents[agentId].historyLoaded) return; // already loaded

  try {
    const res = await authFetch(`/api/chat/history?agentId=${agentId}`);
    if (!res.ok) return;
    const { messages } = await res.json();

    if (messages && messages.length > 0) {
      const parsed: Message[] = messages.map((m: any) => ({
        id: m.id,
        type: m.type as 'user' | 'bot',
        text: m.text || '',
        timestamp: new Date(m.created_at),
        agentId: m.agent_id as AgentId,
        imageUrl: m.image_url || undefined,
        richCard: m.rich_card || undefined,
      }));
      store.setMessages(agentId, parsed);
    }
  } catch {
    // silent fail
  } finally {
    store.setHistoryLoaded(agentId);
  }
}

/**
 * Send a text message and stream the response.
 * Optionally attach an image (base64 data URL) which will be:
 *   1. Shown as a thumbnail in the user's message bubble
 *   2. Sent to Claude as vision content so the Stylist can see it
 *   3. For the Style agent: also run through /api/style/analyze for a structured card
 */
export async function sendMessage(
  agentId: AgentId,
  text: string,
  imageBase64?: string
) {
  const store = useChatStore.getState();

  // Add user message (with optional image for thumbnail display)
  const userMsg: Message = {
    id: crypto.randomUUID(),
    type: 'user',
    text,
    timestamp: new Date(),
    agentId,
    imageUrl: imageBase64,
  };
  store.addMessage(agentId, userMsg);

  // Persist user message to DB (fire-and-forget)
  persistMessage(userMsg);

  // Create placeholder bot message
  const botMsg: Message = {
    id: crypto.randomUUID(),
    type: 'bot',
    text: '',
    timestamp: new Date(),
    agentId,
  };
  store.addMessage(agentId, botMsg);
  store.setStreaming(agentId, true);

  try {
    // Send styleProfile for style agent, or for 'all' (in case it routes to style)
    const styleProfile =
      (agentId === 'style' || agentId === 'all') ? useStyleStore.getState().profile : undefined;

    const allMessages = store.getMessages(agentId);
    // Exclude the empty bot placeholder
    const apiMessages = toApiMessages(
      allMessages.filter((m) => m.text.length > 0 || m.imageUrl)
    );

    // If this is the style agent and an image was sent, run structured analysis
    // in parallel with the streaming chat response
    const analysisPromise =
      agentId === 'style' && imageBase64
        ? runStyleAnalysis(imageBase64, text, agentId)
        : null;

    // Stream the conversational response (backend handles 'all' classification)
    const res = await authFetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
        messages: apiMessages,
        styleProfile,
        location: useLocationStore.getState().coords ?? undefined,
      }),
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    await readStream(res, agentId);

    // Rich cards are now ground-truth only:
    //   - `placesList` cards come from the server via SSE (Google Places API)
    //   - style cards (`colorSeason`, `outfit`) come from /api/style/analyze below
    // We deliberately do NOT parse rich cards out of the model's free text —
    // that was a source of hallucinated data (fake flights, classes, places).
    const finalMessages = store.getMessages(agentId);
    const lastBot = finalMessages[finalMessages.length - 1];

    if (lastBot && lastBot.type === 'bot' && lastBot.text) {
      persistMessage(lastBot);
    }

    // If analysis was running, wait for it and attach the card
    if (analysisPromise) {
      const richCard = await analysisPromise;
      if (richCard) {
        store.setRichCardOnLastBot(agentId, richCard);
        // Re-persist the bot message now that it has a rich card
        const updatedMessages = store.getMessages(agentId);
        const updatedBot = updatedMessages[updatedMessages.length - 1];
        if (updatedBot && updatedBot.type === 'bot') {
          persistMessage(updatedBot);
        }
      }
    }
  } catch (err: any) {
    store.appendToLastBot(
      agentId,
      err.message?.includes('API error')
        ? 'Sorry, I had trouble connecting. Please try again!'
        : `Something went wrong: ${err.message}`
    );
  } finally {
    store.setStreaming(agentId, false);
  }
}

/**
 * Determine the analysis type from the user's text and run /api/style/analyze.
 * Returns a RichCard if successful, null otherwise.
 */
async function runStyleAnalysis(
  imageBase64: string,
  userText: string,
  agentId: AgentId
): Promise<RichCard | null> {
  // Decide analysis type from user intent
  const lower = userText.toLowerCase();
  let type: 'skin_tone' | 'outfit_rating' | 'clothing_tag' = 'skin_tone';
  if (lower.includes('outfit') || lower.includes('rate') || lower.includes('wearing')) {
    type = 'outfit_rating';
  } else if (
    lower.includes('wardrobe') ||
    lower.includes('clothing') ||
    lower.includes('tag') ||
    lower.includes('item')
  ) {
    type = 'clothing_tag';
  }

  try {
    const res = await authFetch('/api/style/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64, type }),
    });

    if (!res.ok) return null;
    const { result } = await res.json();

    if (type === 'skin_tone' && result?.season && result?.bestColors) {
      // Save to style profile
      useStyleStore.getState().setSkinTone({
        depth: result.depth,
        undertone: result.undertone,
        season: result.season,
        bestColors: result.bestColors,
        bestMetals: result.bestMetals,
      });

      return {
        type: 'colorSeason',
        data: {
          season: result.season,
          colors: result.bestColors,
          metals: result.bestMetals,
        },
      };
    }

    if (type === 'outfit_rating' && result?.score != null) {
      return {
        type: 'outfit',
        data: result,
      };
    }

    if (type === 'clothing_tag' && result?.category) {
      // Auto-add to wardrobe
      useStyleStore.getState().addWardrobeItem({
        id: crypto.randomUUID(),
        imageUrl: imageBase64,
        category: result.category,
        color: result.color,
        colorHex: result.colorHex,
        style: result.style,
        seasons: result.seasons,
        occasions: result.occasions,
        pairsWith: result.pairsWith,
        addedAt: new Date().toISOString(),
      });
    }

    return null;
  } catch {
    return null;
  }
}

// ── Conversation Management ─────────────────────────────────

/** Clear chat history for a specific agent. */
export async function clearChatHistory(agentId: AgentId): Promise<void> {
  if (agentId === 'all') {
    await clearAllHistory();
    return;
  }
  try {
    await authFetch(`/api/chat/messages?agentId=${agentId}`, { method: 'DELETE' });
  } catch {
    // silent fail
  }
  useChatStore.getState().clearMessages(agentId);
}

/** Clear ALL chat history across all agents. */
export async function clearAllHistory(): Promise<void> {
  try {
    await authFetch('/api/chat/messages', { method: 'DELETE' });
  } catch {
    // silent fail
  }
  useChatStore.getState().clearAllMessages();
}
