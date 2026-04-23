import type { RichCard } from '../app/types';

/**
 * Pure helpers for the `/api/style/analyze` flow.
 *
 * The server may respond with one of three shapes (under `result`):
 *   - a successful structured analysis (has `season` / `score` / `category` …)
 *   - a refusal: `{ refused: true, reason: string }`
 *   - a parse error: `{ error: string, raw?: string }`
 *
 * `interpretAnalysisResponse` turns any of those into a discriminated union the
 * UI can render without branching on raw payload shapes. Refusals and errors
 * get a friendly user-facing message plus retry suggestions — so the chat
 * surfaces *something* useful instead of silently swallowing the attempt.
 */

export type AnalysisType = 'skin_tone' | 'outfit_rating' | 'clothing_tag';

export type StyleAnalysisResult =
  | { kind: 'card'; card: RichCard }
  | {
      kind: 'refused';
      /** Short user-facing headline. */
      message: string;
      /** Actionable retry ideas the UI can render as bullets. */
      suggestions: string[];
    }
  | {
      kind: 'error';
      message: string;
      suggestions: string[];
    }
  | { kind: 'none' };

/**
 * Map free-form user text onto the concrete analysis endpoint we should hit.
 * Keyword-based; deliberately simple and deterministic so we never trigger an
 * expensive flow on a misread phrase.
 */
export function pickAnalysisType(userText: string): AnalysisType {
  const lower = (userText ?? '').toLowerCase();
  if (/\b(outfit|rate|wearing|fit check|how.*look)\b/.test(lower)) {
    return 'outfit_rating';
  }
  if (/\b(wardrobe|clothing|tag|item|piece|garment)\b/.test(lower)) {
    return 'clothing_tag';
  }
  return 'skin_tone';
}

/**
 * Convert the server's `result` payload into a UI-ready StyleAnalysisResult.
 * Pure — no fetch, no side effects, no store writes.
 */
export function interpretAnalysisResponse(
  type: AnalysisType,
  result: unknown
): StyleAnalysisResult {
  if (!result || typeof result !== 'object') {
    return errorResult('We couldn’t analyze this photo right now.');
  }
  const r = result as Record<string, unknown>;

  if (r.refused === true) {
    return {
      kind: 'refused',
      message:
        typeof r.reason === 'string' && r.reason.trim()
          ? summarizeReason(r.reason)
          : 'I couldn’t analyze this photo.',
      suggestions: refusalSuggestions(type),
    };
  }

  if (typeof r.error === 'string' && r.error) {
    return errorResult('I couldn’t read that photo cleanly.');
  }

  switch (type) {
    case 'skin_tone': {
      if (isStringArray(r.bestColors) && typeof r.season === 'string') {
        return {
          kind: 'card',
          card: {
            type: 'colorSeason',
            data: {
              season: r.season,
              colors: r.bestColors,
              metals: typeof r.bestMetals === 'string' ? r.bestMetals : undefined,
            },
          },
        };
      }
      return errorResult("I couldn't read a clear color season from this photo.");
    }
    case 'outfit_rating': {
      if (typeof r.score === 'number') {
        return { kind: 'card', card: { type: 'outfit', data: r } };
      }
      return errorResult("I couldn't rate this outfit — the photo may be too dark or cropped.");
    }
    case 'clothing_tag': {
      // Clothing-tag analysis historically writes into the style store but does
      // not render a chat card. Callers can still act on `r.category` directly.
      if (typeof r.category === 'string') return { kind: 'none' };
      return errorResult("I couldn't recognize a clothing item in this photo.");
    }
    default:
      return errorResult('Unexpected analysis type.');
  }
}

function errorResult(message: string): StyleAnalysisResult {
  return { kind: 'error', message, suggestions: genericSuggestions() };
}

function genericSuggestions(): string[] {
  return [
    'Try a clearer, well-lit photo.',
    'Crop tight on the item or outfit you want analyzed.',
    'Avoid heavy filters — they change the colors the model sees.',
  ];
}

function refusalSuggestions(type: AnalysisType): string[] {
  const common = [
    'Try a photo that doesn’t show identifiable faces (models sometimes decline those).',
    'A flat-lay or mirror-selfie with the face cropped out usually works.',
  ];
  switch (type) {
    case 'skin_tone':
      return [
        ...common,
        'Use natural daylight and a neutral background for accurate color reading.',
      ];
    case 'outfit_rating':
      return [
        ...common,
        'A full-body shot from ~2 metres away gives the best outfit feedback.',
      ];
    case 'clothing_tag':
      return [
        'Shoot one item at a time on a clean surface.',
        'Avoid clutter in the frame so the garment stands out.',
      ];
  }
}

/**
 * Model refusal copy is often long and apologetic. Keep the first sentence so
 * the user gets a hint of *why* without reading a paragraph.
 */
function summarizeReason(reason: string): string {
  const firstSentence = reason.split(/[.!?](?:\s|$)/)[0]?.trim();
  if (!firstSentence) return 'I couldn’t analyze this photo.';
  return firstSentence.length > 160
    ? firstSentence.slice(0, 157) + '…'
    : firstSentence;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/**
 * Render a failure result as a markdown bot message. The chat UI already knows
 * how to format markdown bullets, so we lean on that rather than a new card.
 */
export function formatFailureAsMessage(
  failure: Extract<StyleAnalysisResult, { kind: 'refused' | 'error' }>
): string {
  const header =
    failure.kind === 'refused'
      ? `**I couldn’t analyze that photo.** ${failure.message}`
      : `**Photo analysis failed.** ${failure.message}`;
  const bullets = failure.suggestions.map((s) => `- ${s}`).join('\n');
  return `${header}\n\nHere’s what usually helps:\n${bullets}`;
}
