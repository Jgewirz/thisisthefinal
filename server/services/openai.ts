import OpenAI from 'openai';
import { getAgentConfig, buildSystemPrompt } from '../config/agents.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export async function* streamChat(
  agentId: string,
  messages: ChatMessage[],
  styleProfile?: object
): AsyncGenerator<string> {
  const config = getAgentConfig(agentId);
  const systemPrompt = buildSystemPrompt(agentId, styleProfile);

  const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((m): OpenAI.Chat.Completions.ChatCompletionMessageParam => {
      if (m.role === 'assistant') {
        return { role: 'assistant', content: typeof m.content === 'string' ? m.content : '' };
      }
      return { role: 'user', content: m.content as any };
    }),
  ];

  const stream = await openai.chat.completions.create({
    model: config.model,
    messages: openaiMessages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
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

  const response = await openai.chat.completions.create({
    model: process.env.STYLE_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompts[analysisType] },
          { type: 'image_url', image_url: { url: imageBase64 } },
        ],
      },
    ],
    temperature: parseFloat(process.env.STYLE_VISION_TEMPERATURE || '0.3'),
    max_tokens: 1000,
  });

  const text = response.choices[0]?.message?.content ?? '{}';
  // Extract JSON from possible markdown code fences
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
  const raw = jsonMatch[1]!.trim();

  try {
    return JSON.parse(raw);
  } catch {
    // Try to find a JSON object in the response text
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    throw new Error('Failed to parse image analysis response as JSON');
  }
}
