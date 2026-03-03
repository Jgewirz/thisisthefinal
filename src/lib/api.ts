import type { AgentId, Message, RichCard } from '../app/types';
import { useChatStore } from '../stores/chat';
import { useStyleStore } from '../stores/style';

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
        if (data.token) {
          store.appendToLastBot(agentId, data.token);
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
 * Send a text message and stream the response.
 * Optionally attach an image (base64 data URL) which will be:
 *   1. Shown as a thumbnail in the user's message bubble
 *   2. Sent to GPT-4o as vision content so the Stylist can see it
 *   3. For the Style agent: also run through /api/style/analyze for a structured card
 */
export async function sendMessage(
  agentId: AgentId,
  text: string,
  imageBase64?: string
) {
  const store = useChatStore.getState();
  const effectiveAgent = agentId === 'all' ? 'lifestyle' : agentId;

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
    const styleProfile =
      effectiveAgent === 'style' ? useStyleStore.getState().profile : undefined;

    const allMessages = store.getMessages(agentId);
    // Exclude the empty bot placeholder
    const apiMessages = toApiMessages(
      allMessages.filter((m) => m.text.length > 0 || m.imageUrl)
    );

    // If this is the style agent and an image was sent, run structured analysis
    // in parallel with the streaming chat response
    const analysisPromise =
      effectiveAgent === 'style' && imageBase64
        ? runStyleAnalysis(imageBase64, text, agentId)
        : null;

    // Stream the conversational response
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: effectiveAgent,
        messages: apiMessages,
        styleProfile,
      }),
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    await readStream(res, agentId);

    // If analysis was running, wait for it and attach the card
    if (analysisPromise) {
      const richCard = await analysisPromise;
      if (richCard) {
        store.setRichCardOnLastBot(agentId, richCard);
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
    const res = await fetch('/api/style/analyze', {
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
