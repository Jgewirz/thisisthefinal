import Anthropic from '@anthropic-ai/sdk';
import { getAgentConfig, buildSystemPrompt } from '../config/agents.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

/**
 * Convert our ChatMessage content to Anthropic's content block format.
 */
function toAnthropicContent(
  content: ChatMessage['content']
): Anthropic.Messages.ContentBlockParam[] {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  return content.map((part) => {
    if (part.type === 'text') {
      return { type: 'text' as const, text: part.text! };
    }
    if (part.type === 'image_url' && part.image_url) {
      const url = part.image_url.url;
      // data:image/jpeg;base64,/9j/4AAQ...
      const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: match[2],
          },
        };
      }
      // If not base64, try as URL
      return {
        type: 'image' as const,
        source: { type: 'url' as const, url } as any,
      };
    }
    return { type: 'text' as const, text: '' };
  });
}

export async function* streamChat(
  agentId: string,
  messages: ChatMessage[],
  styleProfile?: object,
  abortSignal?: AbortSignal
): AsyncGenerator<string> {
  const config = getAgentConfig(agentId);
  const systemPrompt = buildSystemPrompt(agentId, styleProfile);

  const anthropicMessages: Anthropic.Messages.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: toAnthropicContent(m.content),
  }));

  const stream = anthropic.messages.stream({
    model: config.model,
    system: systemPrompt,
    messages: anthropicMessages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
  });

  // ── Stream timeout — abort if no tokens arrive within 60s ──
  const STREAM_TIMEOUT_MS = 60_000;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const resetTimeout = () => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    timeoutHandle = setTimeout(() => {
      stream.abort();
    }, STREAM_TIMEOUT_MS);
  };
  resetTimeout(); // start the clock

  try {
    for await (const event of stream) {
      if (abortSignal?.aborted) {
        stream.abort();
        return;
      }
      resetTimeout(); // got activity — push deadline forward
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  } catch (err: any) {
    if (abortSignal?.aborted) return; // expected abort
    throw err;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export async function analyzeImage(
  imageBase64: string,
  analysisType: 'skin_tone' | 'outfit_rating' | 'clothing_tag'
): Promise<object> {
  const prompts: Record<string, string> = {
    skin_tone: `Analyze this selfie for color season analysis. Return ONLY valid JSON:
{
  "depth": "fair" | "light" | "medium" | "tan" | "deep",
  "undertone": "warm" | "cool" | "neutral",
  "season": "<one of: Light Spring, True Spring, Bright Spring, Light Summer, True Summer, Soft Summer, Soft Autumn, True Autumn, Deep Autumn, Deep Winter, True Winter, Bright Winter>",
  "confidence": <0.0-1.0>,
  "bestColors": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5", "#hex6", "#hex7", "#hex8"],
  "bestMetals": "Gold, Rose Gold" | "Silver, Platinum" | etc,
  "avoidColors": ["#hex1", "#hex2", "#hex3"]
}`,
    outfit_rating: `Rate this outfit photo. Return ONLY valid JSON:
{
  "score": <1-10>,
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "accessorySuggestions": ["suggestion1", "suggestion2"],
  "colorHarmony": "excellent" | "good" | "needs work",
  "overallVibe": "<2-3 word description>"
}`,
    clothing_tag: `Tag this clothing item. Return ONLY valid JSON:
{
  "category": "top" | "bottom" | "dress" | "outerwear" | "shoes" | "accessory",
  "color": "<color name>",
  "colorHex": "#hex",
  "style": "casual" | "smart-casual" | "business" | "formal" | "athleisure",
  "seasons": ["spring", "summer", "fall", "winter"],
  "occasions": ["work", "casual", "date-night", "formal", "workout"],
  "pairsWith": ["item1", "item2", "item3"]
}`,
  };

  // Parse base64 image for Anthropic format
  const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
  const imageContent: Anthropic.Messages.ImageBlockParam = match
    ? {
        type: 'image',
        source: {
          type: 'base64',
          media_type: match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: match[2],
        },
      }
    : {
        type: 'image',
        source: { type: 'url', url: imageBase64 } as any,
      };

  const config = getAgentConfig('style');

  const response = await anthropic.messages.create({
    model: config.model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompts[analysisType] },
          imageContent,
        ],
      },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  const text = textBlock && 'text' in textBlock ? textBlock.text : '{}';
  // Extract JSON from possible markdown code fences
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
  try {
    return JSON.parse(jsonMatch[1]!.trim());
  } catch (err: any) {
    console.error('Failed to parse image analysis JSON:', err.message, '\nRaw text:', text);
    return { error: 'Failed to parse AI response', raw: text };
  }
}
