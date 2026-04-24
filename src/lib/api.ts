import type { AgentId, Message } from '../app/types';
import { useChatStore } from '../stores/chat';
import { useStyleStore } from '../stores/style';
import { useAuthStore } from '../stores/auth';
import { useLocationStore } from '../stores/location';
import {
  formatFailureAsMessage,
  interpretAnalysisResponse,
  pickAnalysisType,
  type StyleAnalysisResult,
} from './styleAnalysis';

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

/**
 * Read an SSE stream and push tokens into the store.
 * Returns the classified agent ID as reported by the server (may differ from
 * `agentId` when the caller is the "all" tab and the server routes to a
 * specialist).
 */
async function readStream(res: Response, agentId: AgentId): Promise<AgentId> {
  const store = useChatStore.getState();
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let classifiedAgent: AgentId = agentId;

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
          classifiedAgent = data.classifiedAgent as AgentId;
          // Update the bot message badge to show the classified specialist
          store.updateLastBotAgentId(agentId, classifiedAgent);
        }
        if (data.token) {
          store.appendToLastBot(agentId, data.token);
        }
        if (data.card && typeof data.card === 'object' && data.card.type) {
          store.setRichCardOnLastBot(agentId, data.card);
        }
        if (data.activity && typeof data.activity === 'object' && data.activity.kind) {
          store.setActivity(agentId, {
            kind: data.activity.kind,
            detail: data.activity.detail,
            startedAt: Date.now(),
          });
        }
        if (data.error) {
          store.appendToLastBot(agentId, `\n\n[Error: ${data.error}]`);
        }
      } catch {
        // skip malformed JSON
      }
    }
  }

  return classifiedAgent;
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
 * Persist a message to the database.
 * If the message has a base64 image, shrink it to a thumbnail first.
 * Returns whether the server accepted the write (local store is still authoritative for UI).
 */
async function persistMessage(msg: Message): Promise<boolean> {
  let imageUrl = msg.imageUrl;
  if (imageUrl?.startsWith('data:')) {
    imageUrl = await createThumbnail(imageUrl);
  }
  // A single chat turn may be persisted more than once: first with just streamed
  // text, then again after an async rich card (e.g. /api/style/analyze) is
  // attached. The Idempotency-Key must therefore bucket by *payload variant*,
  // not just the message id, or the second write trips the server's
  // "same key, different body" guard (409). Server-side saveChatMessage()
  // already does INSERT ... ON CONFLICT (id) DO UPDATE, so both writes
  // correctly converge to the same row.
  const variant = msg.richCard ? 'with-card' : 'no-card';
  try {
    const res = await authFetch('/api/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `msg:${msg.id}:${variant}`,
      },
      body: JSON.stringify({
        id: msg.id,
        agentId: msg.agentId,
        type: msg.type,
        text: msg.text,
        imageUrl,
        richCard: msg.richCard,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Prevents concurrent loadChatHistory calls for the same agent (e.g. React
// double-effect in dev, rapid navigation, or HMR). Without this guard two
// concurrent loads can both pass the historyLoaded=false check, then the
// second one's setMessages call silently clobbers the first.
const _loadInProgress = new Set<AgentId>();

/**
 * Load chat history from the database for a given agent.
 * Uses an atomic Zustand setState updater so the merge with any optimistic
 * messages that were added while the fetch was in-flight is race-free.
 */
export async function loadChatHistory(agentId: AgentId): Promise<void> {
  if (useChatStore.getState().agents[agentId].historyLoaded) return;
  if (_loadInProgress.has(agentId)) return;
  _loadInProgress.add(agentId);

  try {
    const res = await authFetch(`/api/chat/history?agentId=${agentId}&limit=200`);
    if (!res.ok) return;
    const { messages } = await res.json();

    if (Array.isArray(messages) && messages.length > 0) {
      const parsed: Message[] = messages.map((m: any) => ({
        id: m.id,
        type: m.type as 'user' | 'bot',
        text: m.text || '',
        timestamp: new Date(m.created_at),
        agentId: m.agent_id as AgentId,
        imageUrl: m.image_url || undefined,
        richCard: m.rich_card || undefined,
      }));

      // Merge inside the Zustand updater so read + write is one atomic
      // operation — no window where an interleaved addMessage can be lost.
      useChatStore.setState((state) => {
        const existing = state.agents[agentId].messages;
        let next: Message[];
        if (existing.length === 0) {
          next = parsed;
        } else {
          // existing (in-memory) wins over DB for the same id — the in-memory
          // copy may have a richer state (e.g. richCard from style analysis).
          const byId = new Map<string, Message>();
          for (const m of [...parsed, ...existing]) byId.set(m.id, m);
          next = Array.from(byId.values()).sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
          );
        }
        return {
          agents: {
            ...state.agents,
            [agentId]: { ...state.agents[agentId], messages: next },
          },
        };
      });
    }
  } catch {
    // silent fail — UI keeps working; user can reload if needed
  } finally {
    _loadInProgress.delete(agentId);
    useChatStore.getState().setHistoryLoaded(agentId);
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

  await persistMessage(userMsg);

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
      const body = await res.text().catch(() => '');
      throw new Error(`API error: ${res.status}${body ? ` — ${body.slice(0, 200)}` : ''}`);
    }

    const classifiedAgent = await readStream(res, agentId);

    // Rich cards are now ground-truth only:
    //   - `placesList` cards come from the server via SSE (Google Places API)
    //   - style cards (`colorSeason`, `outfit`) come from /api/style/analyze below
    // We deliberately do NOT parse rich cards out of the model's free text —
    // that was a source of hallucinated data (fake flights, classes, places).
    const finalMessages = store.getMessages(agentId);
    const lastBot = finalMessages[finalMessages.length - 1];

    // Persist every assistant turn: text-only, card-only (Places/Flights/etc.), or both.
    if (lastBot?.type === 'bot') {
      await persistMessage(lastBot);
    }

    // Cross-tab population: when the user types from the "all" tab and the
    // server classifies the message as a specialist (e.g. "travel"), the user
    // message is persisted under agent_id="all" but the bot reply lands under
    // agent_id="travel". After a refresh the Travel tab therefore shows the
    // bot reply without the user's question. Fix: also persist (and mirror
    // in-memory) the user message under the classified agent.
    if (agentId === 'all' && classifiedAgent !== 'all') {
      const crossUserMsg: Message = { ...userMsg, agentId: classifiedAgent };
      // Add to the specialist's in-memory store (dedup: skip if already present)
      const inSpecialist = store.getMessages(classifiedAgent);
      if (!inSpecialist.some((m) => m.id === userMsg.id)) {
        store.addMessage(classifiedAgent, crossUserMsg);
      }
      // Save to DB under the classified agent so the specialist tab survives refresh
      await persistMessage(crossUserMsg);
    }

    // If analysis was running, wait for it. On success we attach the rich
    // card; on refusal / parse failure we append a friendly bot message with
    // retry suggestions so the user isn't left wondering why nothing happened.
    if (analysisPromise) {
      const outcome = await analysisPromise;
      if (outcome.kind === 'card') {
        store.setRichCardOnLastBot(agentId, outcome.card);
      } else if (outcome.kind === 'refused' || outcome.kind === 'error') {
        store.appendToLastBot(agentId, `\n\n${formatFailureAsMessage(outcome)}`);
      }
      const updatedMessages = store.getMessages(agentId);
      const updatedBot = updatedMessages[updatedMessages.length - 1];
      if (updatedBot?.type === 'bot') {
        await persistMessage(updatedBot);
      }
    }
  } catch (err: any) {
    store.appendToLastBot(
      agentId,
      err.message?.includes('API error')
        ? `Sorry, I had trouble connecting (${String(err.message).replace(/^API error:\s*/i, '')}). Please try again!`
        : `Something went wrong: ${err.message}`
    );
    const afterErr = store.getMessages(agentId);
    const errBot = afterErr[afterErr.length - 1];
    if (errBot?.type === 'bot') {
      await persistMessage(errBot);
    }
  } finally {
    store.setStreaming(agentId, false);
  }
}

/**
 * Run /api/style/analyze and return a structured result the caller can act on:
 *   - `card` — attach to the bot message as a rich card
 *   - `refused` / `error` — surface a friendly message with retry suggestions
 *   - `none` — succeeded but produces no card (e.g. clothing_tag)
 */
async function runStyleAnalysis(
  imageBase64: string,
  userText: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _agentId: AgentId
): Promise<StyleAnalysisResult> {
  const type = pickAnalysisType(userText);

  let result: unknown;
  try {
    const res = await authFetch('/api/style/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageBase64, type }),
    });
    if (!res.ok) {
      if (res.status === 413) {
        return {
          kind: 'error',
          message: 'That photo is too large (max 8 MB). Try compressing or resizing it.',
          suggestions: ['Export at a lower resolution (e.g. 1500px wide).'],
        };
      }
      return {
        kind: 'error',
        message: 'Photo analysis service is unavailable right now.',
        suggestions: ['Try again in a moment, or use a different photo.'],
      };
    }
    const json = await res.json();
    result = json?.result;
  } catch {
    return {
      kind: 'error',
      message: 'Network problem while analyzing the photo.',
      suggestions: ['Check your connection and try again.'],
    };
  }

  const outcome = interpretAnalysisResponse(type, result);

  // Side-effects for successful skin_tone / clothing_tag flows — kept here so
  // interpretAnalysisResponse stays pure and trivially testable.
  if (
    outcome.kind === 'card' &&
    outcome.card.type === 'colorSeason' &&
    result &&
    typeof result === 'object'
  ) {
    const r = result as Record<string, unknown>;
    useStyleStore.getState().setSkinTone({
      depth: typeof r.depth === 'string' ? r.depth : '',
      undertone: typeof r.undertone === 'string' ? r.undertone : '',
      season: typeof r.season === 'string' ? r.season : '',
      bestColors: Array.isArray(r.bestColors) ? (r.bestColors as string[]) : [],
      bestMetals: typeof r.bestMetals === 'string' ? r.bestMetals : '',
    });
  }
  if (type === 'clothing_tag' && outcome.kind === 'none' && result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if (typeof r.category === 'string') {
      useStyleStore.getState().addWardrobeItem({
        id: crypto.randomUUID(),
        imageUrl: imageBase64,
        category: r.category,
        color: typeof r.color === 'string' ? r.color : '',
        colorHex: typeof r.colorHex === 'string' ? r.colorHex : '',
        style: typeof r.style === 'string' ? r.style : '',
        seasons: Array.isArray(r.seasons) ? (r.seasons as string[]) : [],
        occasions: Array.isArray(r.occasions) ? (r.occasions as string[]) : [],
        pairsWith: Array.isArray(r.pairsWith) ? (r.pairsWith as string[]) : [],
        addedAt: new Date().toISOString(),
      });
    }
  }

  return outcome;
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
