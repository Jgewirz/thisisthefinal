# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GirlBot** — a mobile-first AI lifestyle chat app built with React + Vite (frontend), Express (backend), and a Python booking agent sidecar. Users interact with four specialized GPT-4o-powered agents through a dark-themed UI:

- **The Stylist** (`style`) — fashion, color analysis, wardrobe management, outfit rating, selfie analysis (vision)
- **The Voyager** (`travel`) — flights (Amadeus), hotels (Amadeus + Google Places enrichment), restaurants, trip planning, flight booking (browser-use agent)
- **The Trainer** (`fitness`) — gym/studio discovery (Google Places + Mindbody enrichment), class schedules, workout recommendations
- **The Curator** (`lifestyle`) — general chat, reminders, daily planning, restaurant discovery/reservations (also handles `"all"` tab)

## Commands

```bash
npm run dev          # Vite frontend dev server (port 5173)
npm run server       # Express API server with tsx watch (port 3001)
npm run server:booking  # Python booking agent (FastAPI, port 8000)
npm run dev:all      # All three concurrently
npm run build        # Production build to dist/
```

No test runner or linter is configured. TypeScript has pre-existing `noImplicitAny` errors in Zustand store callbacks — these don't affect runtime (Vite uses esbuild).

## Required Environment Variables

Only `OPENAI_API_KEY` is strictly required. See `.env.example` for all options. Key optional integrations:
- `AMADEUS_CLIENT_ID` + `AMADEUS_CLIENT_SECRET` — flight/hotel search
- `GOOGLE_PLACES_API_KEY` — venue/studio/restaurant/hotel discovery + enrichment
- `MINDBODY_API_KEY` + related vars — real-time fitness class schedules
- `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` — wardrobe image uploads
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_TOKEN_ENCRYPTION_KEY` — Google Calendar + OAuth
- `BOOKING_AGENT_URL` — Python booking agent URL (default: `http://localhost:8000`)
- `SESSION_SECRET` — session signing (falls back to `OPENAI_API_KEY`)
- Per-agent model overrides: `STYLE_MODEL`, `TRAVEL_MODEL`, `FITNESS_MODEL`, `LIFESTYLE_MODEL`

## Architecture

### Frontend (`src/`)
- **Vite + React 18 + TypeScript** with Tailwind CSS v4 and shadcn/ui
- **Routing**: React Router v7 — routes: `/`, `/style`, `/travel`, `/fitness`, `/lifestyle`, `/saved`, `/calendar`
- **State**: Zustand stores in `src/stores/` — `chat.ts`, `style.ts`, `travel.ts`, `fitness.ts`, `calendar.ts`, `location.ts`, `user.ts`, `lifestyle.ts` (all persisted to localStorage via Zustand persist)
- **API layer** (`src/lib/api.ts`): `sendMessage()` streams chat via SSE; agent-specific search functions (`runTravelSearch`, `runFitnessSearch`, `runStyleAnalysis`, `runLifestyleSearch`) fire alongside chat for their agent only
- **Path alias**: `@` maps to `./src`

### Backend (`server/`)
- **Express on port 3001**, proxied from Vite dev server at `/api`
- **Authentication**: Session-based auth middleware on all `/api/*` routes (except `/api/auth` and `/api/health`). `readSessionUserId()` extracts user from request.
- **Database**: SQLite via better-sqlite3 (`server/data/girlbot.sqlite3`). Migrations in `server/db/migrations/` (001-013), auto-run on startup via `runMigrations()`.
- **Agent configs** (`server/config/agents.ts`): system prompts per agent, model settings, vision support flags. `buildSystemPrompt()` injects profile placeholders (`{{STYLE_PROFILE}}`, `{{TRAVEL_PROFILE}}`, etc.)

### Booking Agent (`booking-agent/`)
- **Python FastAPI sidecar** on port 8000
- Uses `browser-use` + Playwright to automate flight booking on airline websites
- Express backend proxies requests via `BOOKING_AGENT_URL`
- Job-based async: `POST /book` → returns jobId → poll `GET /status/{jobId}`
- Safety: agent stops at payment page, never enters credit card info
- Frontend: `FlightBookingFlow.tsx` handles passenger info form → progress tracking → result display

### API Routes
| Route prefix | File | Purpose |
|---|---|---|
| `/api/chat` | `chat.ts` | SSE streaming chat + chat history persistence |
| `/api/style` | `style.ts` | Vision analysis, style profile, wardrobe CRUD |
| `/api/travel` | `travel.ts` | Flight search (Amadeus), hotel search (Amadeus + Google Places), POI search, flight booking proxy |
| `/api/fitness` | `fitness.ts` | Studio search (Google Places + Mindbody enrichment) |
| `/api/lifestyle` | `lifestyle.ts` | Restaurant/cafe discovery, reservations |
| `/api/location` | `location.ts` | Shared user location management |
| `/api/calendar` | `calendar.ts` | Google Calendar integration |
| `/api/dining` | `dining.ts` | Restaurant reservations |
| `/api/auth` | `auth.ts`, `google-auth.ts` | Session auth + Google OAuth |

### External Services (`server/services/`)
- `openai.ts` — GPT-4o streaming + vision + intent extraction (`extractTravelParams`, `extractFitnessParams`, `extractLifestyleParams`)
- `amadeus.ts` — Amadeus flight/hotel search; hotel search parses all `offers[]` into `RoomOffer[]` array
- `google-places.ts` — Google Places API (New) for venues, photos, reviews
- `hotel-enricher.ts` — Merges Google Places data (photo, rating, reviews, summary) into Amadeus hotel results
- `studio-enricher.ts` — Multi-source fitness schedule pipeline: cache → Mindbody API v6 → GPT extraction fallback
- `cloudinary.ts` — Image uploads for wardrobe
- `google-calendar.ts` + `google-tokens.ts` — Calendar integration with encrypted token storage

### Message Flow
1. User types in `ChatInput` → `ChatView.handleSend` → `api.ts:sendMessage()`
2. Adds user message + empty bot placeholder to Zustand store, sets `isStreaming=true`
3. Fetches `POST /api/chat` (proxied to Express), streams SSE tokens → `store.appendToLastBot()`
4. For agents with search capabilities, parallel API calls fire alongside chat (e.g., `runTravelSearch` for travel agent)
5. Search results attach `RichCard` to bot message via `store.setRichCardOnLastBot()`
6. `MessageBubble` renders the appropriate card component based on `richCard.type`

### Rich Card System
Cards are rendered by `MessageBubble` based on `richCard.type`:

| `richCard.type` | Card Component | Agent |
|---|---|---|
| `colorSeason` | `ColorSeasonCard` | Style |
| `outfit` | `OutfitRatingCard` | Style |
| `wardrobeItem` | `WardrobeItemCard` | Style |
| `flight` | `FlightCard` | Travel |
| `cheapestDates` | `CheapestDatesCard` | Travel |
| `hotel` | `HotelCard` | Travel |
| `place` | `PlaceCard` | Travel |
| `restaurant` | `RestaurantCard` | Travel / Lifestyle |
| `fitnessStudio` | `FitnessStudioCard` | Fitness |
| `fitnessClass` | `FitnessClassCard` | Fitness |
| `bookingConfirmation` | `BookingConfirmationCard` | Fitness |
| `flightBookingConfirmation` | `FlightBookingConfirmationCard` | Travel |
| `reservationConfirmation` | `ReservationConfirmationCard` | Lifestyle |
| `reminder` | (inline) | Lifestyle |

### Design System
- CSS custom properties in `src/styles/theme.css` (color tokens per agent, typography)
- Fonts: DM Sans (headings) + Work Sans (body)
- Agent accent colors: `--accent-style`, `--accent-travel`, `--accent-fitness`, `--accent-lifestyle`, `--accent-calendar`

## Key Conventions

- **Agent isolation is mandatory**: Each agent must stay in its domain. Off-topic questions redirect to the correct specialist. System prompts have "STRICT SCOPE — NEVER VIOLATE" sections.
- The `"all"` agent ID routes to `lifestyle` on the backend (`getAgentConfig` falls back to lifestyle)
- Only the Style agent supports vision (image analysis)
- SSE format: `data: {"token": "..."}\n\n` for streaming, `data: {"error": "..."}\n\n` for errors
- Dual persistence: Zustand stores persist to localStorage; write-through to SQLite via fire-and-forget API calls
- GPT intent extraction functions return `type: "none"` for messages outside their domain
- Backend routes are namespaced by agent: `/api/style/*`, `/api/travel/*`, `/api/fitness/*`, `/api/lifestyle/*`
- Frontend search functions only fire for their specific `agentId`
- Multi-card attachment: first card attaches to last bot message via `setRichCardOnLastBot()`; subsequent cards spawn new bot messages via `appendRichCards()`

## Non-Obvious Implementation Details

### Search Intent & Follow-up System
- **Travel**: Intent extracted from every message via `/api/travel/extract`; last 6 API messages passed as `context` for refinements. The `lastSearchIntent` (stored in Zustand travel store) is sent alongside context so GPT has the exact previous search params to carry forward for follow-ups like "find hotels near central park between $200 and $350".
- **Fitness**: Heuristic keyword matching (action terms + class types + location cues) gates whether extraction fires at all
- **Lifestyle**: Dedicated extraction pipeline for restaurants/cafes/reservations; falls back to shared place search for generic POI queries
- **Location-first**: `ensureLocationForSearchQuery()` triggers browser geolocation before any "near me" query

### Hotel Search Pipeline (4-tier cascading fallback)
1. Amadeus with all filters (price range, star rating, board type)
2. Relax price filters if results < 3
3. Relax star rating filters if still < 3
4. Google Places-only fallback if Amadeus returns 0

Hotels from Amadeus are enriched via `hotel-enricher.ts` with Google Places data (photos, reviews, ratings, editorial summary). Each hotel card shows multiple `RoomOffer[]` with an interactive room selector.

### Profile Injection & Token Management
- `buildSystemPrompt()` replaces placeholders (`{{STYLE_PROFILE}}`, `{{TRAVEL_PROFILE}}`, `{{FITNESS_PROFILE}}`, `{{USER_LOCATION}}`) with compressed JSON
- `buildChatProfile()` strips `imageUrl`/`thumbnailUrl` from wardrobe items to save tokens
- Chat history capped to last 20 messages to prevent token overflow

### Image Handling
- Non-vision agents receive `(Image sent — this agent cannot view images)` instead of `image_url` content parts
- `sanitizeMessagesForAgent()` in chat route strips image data before sending to OpenAI for non-style agents
- Wardrobe images upload to Cloudinary via `useStyleStore.uploadAndAddItem()`

### Fitness Studio Schedule Pipeline (3-tier fallback)
1. Check SQLite cache (`studio_schedule_cache` table)
2. Query Mindbody API v6
3. Fall back to GPT extraction if API unavailable

### Streaming & Timeouts
- SSE idle timeout: 45s to detect dead connections (separate from 20s HTTP request timeout)
- Stream cleanup: `res.write('data: {"done": true}\n\n')` signals end; client handles `done` flag

### Google OAuth
- Tokens stored in DB encrypted with `GOOGLE_TOKEN_ENCRYPTION_KEY` (64-char hex)
- Frontend never touches raw tokens; all OAuth flows go through `/api/google-auth/*`

### Flight Booking Flow
- Express proxies booking requests to Python sidecar at `BOOKING_AGENT_URL`
- Booking state persisted in `flight_bookings` table (migration 013)
- Frontend polls status via `GET /api/travel/book/:jobId/status` every 2s with auto-timeout at 2 minutes
- Completed bookings can be added to Google Calendar via `POST /api/travel/book/:jobId/calendar`
