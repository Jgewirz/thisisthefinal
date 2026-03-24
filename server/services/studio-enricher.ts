// ── Studio Schedule Enricher ────────────────────────────────────────────
// Multi-source class schedule resolution:
//   1. Check SQLite cache (24h TTL)
//   2. Detect booking platform from studio website (Mindbody, Momoyoga, etc.)
//   3. If Mindbody detected → hit Public API v6 for real class data
//   4. Fallback → GPT-4o-mini extraction from website HTML

import OpenAI from 'openai';
import { getDb } from '../db/sqlite.js';
import type { GooglePlace } from './google-places.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface StudioClass {
  name: string;
  time: string;
  endTime?: string;
  instructor?: string;
  duration?: string;
  level?: string;
  category?: string;
  spotsRemaining?: number | null;
  imageUrl?: string;
  mindbodyClassId?: string;
  bookingPlatform?: 'mindbody' | 'website' | 'none';
  bookingUrl?: string;
}

export interface EnrichedStudio extends GooglePlace {
  todayClasses: StudioClass[];
  scheduleSource: 'mindbody' | 'website' | 'cached' | 'unavailable';
  mindbodySiteId?: string;
}

// ── OpenAI client ───────────────────────────────────────────────────────

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// ── Cache helpers ───────────────────────────────────────────────────────

interface CacheRow {
  classes_json: string;
  source_url: string | null;
}

function getCachedSchedule(placeId: string): { classes: StudioClass[]; source: string } | null {
  const db = getDb();
  const row = db.prepare(
    "SELECT classes_json, source_url FROM studio_schedule_cache WHERE place_id = ? AND expires_at > datetime('now')"
  ).get(placeId) as CacheRow | undefined;

  if (!row) return null;
  try {
    return { classes: JSON.parse(row.classes_json), source: row.source_url || 'cached' };
  } catch {
    return null;
  }
}

function setCachedSchedule(
  placeId: string,
  studioName: string,
  classes: StudioClass[],
  sourceUrl: string | null
): void {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO studio_schedule_cache (place_id, studio_name, classes_json, source_url, fetched_at, expires_at)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now', '+24 hours'))`
  ).run(placeId, studioName, JSON.stringify(classes), sourceUrl);
}

// ══════════════════════════════════════════════════════════════════════════
// SOURCE 1: MINDBODY PUBLIC API v6
// ══════════════════════════════════════════════════════════════════════════

const MINDBODY_API_BASE = 'https://api.mindbodyonline.com/public/v6';

function isMindbodyConfigured(): boolean {
  return !!process.env.MINDBODY_API_KEY;
}

/**
 * Scan website HTML for Mindbody site ID.
 * Studios embed Mindbody in various ways:
 *   - studioid=12345 (widget URLs, booking links)
 *   - siteId: 12345 (JS config)
 *   - mindbodyonline.com/explore/locations/slug
 *   - healcode.com/widgets/...?options[site_id]=12345
 */
function extractMindbodySiteId(html: string): string | null {
  // Pattern 1: studioid= in URLs
  const studioIdMatch = html.match(/studioid[=:][\s"']*(-?\d+)/i);
  if (studioIdMatch) return studioIdMatch[1];

  // Pattern 2: site_id in healcode/widget options
  const siteIdMatch = html.match(/site_id[=\]"':]+\s*(\d+)/i);
  if (siteIdMatch) return siteIdMatch[1];

  // Pattern 3: siteId in JS object
  const jsSiteId = html.match(/siteId["'\s:]+["']?(-?\d+)/);
  if (jsSiteId) return jsSiteId[1];

  // Pattern 4: mindbody site ID in data attributes
  const dataAttr = html.match(/data-site-id=["'](\d+)["']/i);
  if (dataAttr) return dataAttr[1];

  // Pattern 5: branded web widget embed
  const widgetMatch = html.match(/widgets\.mindbodyonline\.com\/widgets\/[\w-]+\/([a-f0-9]+)/i);
  if (widgetMatch) return widgetMatch[1]; // This is a widget token, not site ID — handle separately

  return null;
}

/**
 * Detect if the website references Mindbody at all.
 */
function detectsMindbody(html: string): boolean {
  const signals = [
    'mindbody', 'mindbodyonline', 'healcode',
    'clients.mindbodyonline.com', 'branded-web',
  ];
  const lower = html.toLowerCase();
  return signals.some((s) => lower.includes(s));
}

/**
 * Fetch today's classes from Mindbody Public API v6.
 */
async function fetchMindbodyClasses(siteId: string): Promise<StudioClass[]> {
  const apiKey = process.env.MINDBODY_API_KEY;
  if (!apiKey) return [];

  const today = new Date();
  const startDate = today.toISOString().split('T')[0] + 'T00:00:00';
  const endDate = today.toISOString().split('T')[0] + 'T23:59:59';

  const url = `${MINDBODY_API_BASE}/class/classes?request.StartDateTime=${encodeURIComponent(startDate)}&request.EndDateTime=${encodeURIComponent(endDate)}&request.Limit=20`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Api-Key': apiKey,
        'SiteId': siteId,
        'Content-Type': 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[mindbody] API returned ${res.status} for site ${siteId}`);
      return [];
    }

    const data = await res.json();
    const classes = data.Classes || [];

    return classes
      .filter((c: any) => !c.IsCanceled && c.IsAvailable !== false)
      .map((c: any): StudioClass => {
        const start = new Date(c.StartDateTime);
        const end = new Date(c.EndDateTime);
        const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

        return {
          name: c.ClassDescription?.Name || 'Class',
          time: start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          endTime: end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          instructor: c.Staff?.DisplayName || c.Staff?.Name || undefined,
          duration: `${durationMin} min`,
          level: c.ClassDescription?.Level?.Name || undefined,
          category: normalizeCategory(
            c.ClassDescription?.SessionType?.Name ||
            c.ClassDescription?.Category ||
            c.ClassDescription?.Name ||
            ''
          ),
          spotsRemaining: c.MaxCapacity != null && c.TotalBooked != null
            ? Math.max(0, c.MaxCapacity - c.TotalBooked)
            : null,
          imageUrl: c.ClassDescription?.ImageURL || undefined,
          mindbodyClassId: c.Id?.toString() || undefined,
          bookingPlatform: 'mindbody',
        };
      })
      .slice(0, 15);
  } catch (err: any) {
    clearTimeout(timeout);
    console.warn(`[mindbody] Failed for site ${siteId}:`, err.message);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════
// SOURCE 2: WEBSITE SCRAPE + GPT EXTRACTION (fallback)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Fetch website HTML and strip to text content.
 */
async function fetchWebsiteHtml(url: string, timeoutMs = 5000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000);
}

/**
 * Use GPT-4o-mini to extract class schedule from website text.
 */
async function extractScheduleViaGpt(websiteText: string, studioName: string): Promise<StudioClass[]> {
  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const ai = getOpenAI();
  const response = await ai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.1,
    max_tokens: 1000,
    messages: [
      {
        role: 'system',
        content: `You extract fitness class schedules from website text. Today is ${dayOfWeek}, ${dateStr}.

Return ONLY valid JSON: {"classes": [...]}

Each class object:
{"name": "Power Yoga", "time": "9:00 AM", "endTime": "10:00 AM", "instructor": "Sarah M.", "duration": "60 min", "level": "All Levels", "category": "yoga"}

Rules:
- Only include classes for TODAY (${dayOfWeek})
- If the schedule shows a weekly view, extract only ${dayOfWeek}'s classes
- Normalize times to 12-hour format with AM/PM
- If no instructor listed, omit the field
- If no level listed, omit the field
- Normalize category to lowercase: yoga, pilates, hiit, spinning, barre, boxing, strength, dance, stretch, meditation, cardio, bootcamp, crossfit
- If duration not explicitly stated but start/end times are given, calculate it
- Maximum 15 classes
- If NO schedule data is found, return {"classes": []}
- Do NOT make up classes — only return what's actually on the page`,
      },
      {
        role: 'user',
        content: `Extract today's (${dayOfWeek}) class schedule from this ${studioName} website:\n\n${websiteText}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '{}';
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed.classes) ? parsed.classes.slice(0, 15) : [];
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════

function normalizeCategory(raw: string): string {
  const lower = raw.toLowerCase();
  const map: Record<string, string> = {
    yoga: 'yoga', vinyasa: 'yoga', hatha: 'yoga', ashtanga: 'yoga', yin: 'yoga', restorative: 'yoga', flow: 'yoga',
    pilates: 'pilates', reformer: 'pilates',
    hiit: 'hiit', 'high intensity': 'hiit', interval: 'hiit', tabata: 'hiit',
    spinning: 'spinning', cycle: 'spinning', cycling: 'spinning', spin: 'spinning', indoor: 'spinning',
    barre: 'barre',
    boxing: 'boxing', kickboxing: 'boxing',
    strength: 'strength', 'weight training': 'strength', sculpt: 'strength', tone: 'strength',
    dance: 'dance', zumba: 'dance',
    stretch: 'stretch', flexibility: 'stretch',
    meditation: 'meditation', mindfulness: 'meditation',
    cardio: 'cardio',
    bootcamp: 'bootcamp', 'boot camp': 'bootcamp', camp: 'bootcamp',
    crossfit: 'crossfit',
  };

  for (const [keyword, category] of Object.entries(map)) {
    if (lower.includes(keyword)) return category;
  }
  return 'fitness';
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN ENRICHMENT PIPELINE
// ══════════════════════════════════════════════════════════════════════════

/**
 * Enrich a single studio with class schedule data.
 * Priority: cache → Mindbody API → website GPT extraction → unavailable
 */
async function enrichSingleStudio(place: GooglePlace): Promise<EnrichedStudio> {
  // ── Step 1: Check cache ──────────────────────────────────────────────
  const cached = getCachedSchedule(place.id);
  if (cached !== null) {
    const source = cached.source === 'mindbody' ? 'mindbody' : 'cached';
    return { ...place, todayClasses: cached.classes, scheduleSource: source as EnrichedStudio['scheduleSource'] };
  }

  // No website → can't enrich
  if (!place.website) {
    return { ...place, todayClasses: [], scheduleSource: 'unavailable' };
  }

  try {
    // ── Step 2: Fetch website HTML ───────────────────────────────────────
    const rawHtml = await fetchWebsiteHtml(place.website);
    if (!rawHtml || rawHtml.length < 100) {
      setCachedSchedule(place.id, place.name, [], place.website);
      return { ...place, todayClasses: [], scheduleSource: 'unavailable' };
    }

    // ── Step 3: Try Mindbody if detected ─────────────────────────────────
    let detectedSiteId: string | null = null;
    if (isMindbodyConfigured() && detectsMindbody(rawHtml)) {
      detectedSiteId = extractMindbodySiteId(rawHtml);
      if (detectedSiteId) {
        console.log(`[enricher] Mindbody detected for ${place.name}, siteId=${detectedSiteId}`);
        const classes = await fetchMindbodyClasses(detectedSiteId);
        if (classes.length > 0) {
          setCachedSchedule(place.id, place.name, classes, `mindbody:${detectedSiteId}`);
          return { ...place, todayClasses: classes, scheduleSource: 'mindbody', mindbodySiteId: detectedSiteId };
        }
        // Mindbody detected but no classes today — still try website text fallback
      }
    }

    // ── Step 4: Fallback — GPT extraction from website text ──────────────
    const websiteText = htmlToText(rawHtml);
    if (websiteText.length < 100) {
      setCachedSchedule(place.id, place.name, [], place.website);
      return { ...place, todayClasses: [], scheduleSource: 'unavailable' };
    }

    const classes = await extractScheduleViaGpt(websiteText, place.name);
    // Tag GPT-extracted classes with booking platform
    for (const cls of classes) {
      cls.bookingPlatform = detectedSiteId ? 'mindbody' : (place.website ? 'website' : 'none');
      cls.bookingUrl = place.website || undefined;
    }
    setCachedSchedule(place.id, place.name, classes, place.website);

    return {
      ...place,
      todayClasses: classes,
      scheduleSource: classes.length > 0 ? 'website' : 'unavailable',
      mindbodySiteId: detectedSiteId || undefined,
    };
  } catch (err: any) {
    console.error(`[enricher] Failed to enrich ${place.name}:`, err.message);
    return { ...place, todayClasses: [], scheduleSource: 'unavailable' };
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Enrich Google Places results with class schedule data.
 * Enriches top `limit` studios in parallel with timeout protection.
 */
export async function enrichStudios(
  places: GooglePlace[],
  limit = 4
): Promise<EnrichedStudio[]> {
  // Purge expired cache entries
  try {
    const db = getDb();
    db.prepare("DELETE FROM studio_schedule_cache WHERE expires_at < datetime('now')").run();
  } catch { /* ignore */ }

  // Enrich the top `limit` in parallel, pass through the rest
  const toEnrich = places.slice(0, limit);
  const passThrough = places.slice(limit);

  const enriched = await Promise.all(
    toEnrich.map((place) =>
      Promise.race([
        enrichSingleStudio(place),
        // 10s timeout per studio — Mindbody + GPT can take a moment
        new Promise<EnrichedStudio>((resolve) =>
          setTimeout(() => resolve({ ...place, todayClasses: [], scheduleSource: 'unavailable' }), 10000)
        ),
      ])
    )
  );

  const rest: EnrichedStudio[] = passThrough.map((place) => ({
    ...place,
    todayClasses: [],
    scheduleSource: 'unavailable',
  }));

  return [...enriched, ...rest];
}
