/**
 * AI Provider abstraction layer.
 *
 * Currently only Anthropic Claude is implemented (in anthropic.ts).
 * This file defines the interface for adding new providers.
 *
 * To add a new provider (e.g., OpenAI, Gemini):
 * 1. Create a new service file (e.g., server/services/openai-provider.ts)
 * 2. Implement the AIProvider interface
 * 3. Update getProviderName() to read from AI_PROVIDER env var
 * 4. Wire the new provider into routes
 */

export interface ChatCompletionMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface ProviderConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface AIProvider {
  readonly name: string;

  /** Stream a chat completion, yielding text tokens. */
  streamChat(
    config: ProviderConfig,
    messages: ChatCompletionMessage[],
    abortSignal?: AbortSignal
  ): AsyncGenerator<string>;

  /** Analyze an image and return raw text response. */
  analyzeImage(
    imageBase64: string,
    prompt: string,
    model: string
  ): Promise<string>;
}

export type ProviderName = 'anthropic' | 'openai';

/** Read the active provider from environment. Defaults to 'anthropic'. */
export function getProviderName(): ProviderName {
  return (process.env.AI_PROVIDER as ProviderName) || 'anthropic';
}
