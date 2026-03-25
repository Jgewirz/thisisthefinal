# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GirlBot** — a mobile-first AI lifestyle chat app built with React + Vite (frontend), Express (backend), and a Python booking agent sidecar. Users interact with four specialized GPT-4o-powered agents through a dark-themed UI:

- **The Stylist** (`style`) — fashion, color analysis, wardrobe management, outfit rating, selfie analysis (vision)
- **The Voyager** (`travel`) — flights (Amadeus), hotels (Amadeus + Google Places enrichment), restaurants, trip planning, flight booking (browser automation)
- **The Trainer** (`fitness`) — gym/studio discovery (Google Places + Mindbody enrichment), class schedules, fitness class booking (browser automation)
- **The Curator** (`lifestyle`) — general chat, reminders, daily planning, restaurant discovery, lifestyle booking (Resy API + browser automation for salons/spas/nails) (also handles `"all"` tab)

## Commands

```bash
npm run dev          # Vite frontend dev server (port 5173)
npm run server       # Express API server with tsx watch (port 3001)
npm run server:booking  # Python booking agent (FastAPI, port 8000)
npm run dev:all      # All three concurrently
npm run build        # Production build to dist/
```

No test runner or linter is configured. TypeScript has pre-existing `noImplicitAny` errors in Zustand store callbacks — these don't affect runtime (Vite uses esbuild).

### Booking Agent CLI (`booking-agent/`)

```bash
# Sign into a booking platform (opens real Chrome, no automation)
python test_booking.py --signin --user myuser --url "https://resy.com/login" --studio "Resy"

# Link Resy account (API auth, no browser needed)
python test_booking.py --link-resy --user myuser

# Test fitness class booking
python test_booking.py --type fitness --user myuser --studio "Studio Name" --website "https://studio.com"

# Test lifestyle booking (restaurant/salon/spa)
python test_booking.py --type lifestyle --user myuser --studio "Venue Name" \
  --website "https://resy.com/cities/mia/nobu" --party-size 2 --date 2026-03-28
```

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
- **Database**: SQLite via better-sqlite3 (`server/data/girlbot.sqlite3`). Migrations in `server/db/migrations/` (001-015), auto-run on startup via `runMigrations()`.
- **Agent configs** (`server/config/agents.ts`): system prompts per agent, model settings, vision support flags. `buildSystemPrompt()` injects profile placeholders (`{{STYLE_PROFILE}}`, `{{TRAVEL_PROFILE}}`, etc.)

### Booking Agent (`booking-agent/`)
- **Python FastAPI sidecar** on port 8000 — handles all browser-based booking automation
- Uses `browser-use` + Playwright to automate bookings via Chrome DevTools Protocol (CDP)
- Express backend proxies requests via `BOOKING_AGENT_URL`
- Job-based async: `POST /book` → returns jobId → poll `GET /status/{jobId}`
- Safety: agent stops at payment page, never enters credit card info

**Three booking domains:**
| Domain | Booker file | Endpoint | Frontend |
|---|---|---|---|
| Flights | `flight_booker.py` | `POST /book` | `FlightBookingFlow.tsx` |
| Fitness | `fitness_booker.py` | `POST /book-fitness` | `FitnessClassBookingFlow.tsx` |
| Lifestyle | `lifestyle_booker.py` | `POST /book-lifestyle` | `LifestyleBookingFlow.tsx` |

**Shared infrastructure:**
- `booking_browser.py` — shared Chrome CDP launch + browser session creation (used by fitness + lifestyle bookers)
- `browser_profiles.py` — persistent Chrome profiles per user in `profiles/{user_id}/`
- `auth_session.py` — tracks login state per user per domain
- `site_memory.py` — learns navigation patterns per domain, stored in `site_profiles/`
- `job_store.py` — async job tracking with step updates

**API-first routing (`api_clients/router.py`):**
- Lifestyle bookings check for direct API support before launching Chrome
- Resy restaurants use `api_clients/resy_client.py` (HTTP, ~2s) instead of browser automation
- Other platforms (OpenTable, Vagaro, Booksy, direct websites) fall through to browser automation

**Sign-in flow:**
- Users sign into booking platforms once via real Chrome (`python test_booking.py --signin`)
- Cookies persist in `profiles/{user_id}/` and are reused for subsequent bookings
- No automation flags during sign-in — prevents bot detection

### API Routes
| Route prefix | File | Purpose |
|---|---|---|
| `/api/chat` | `chat.ts` | SSE streaming chat + chat history persistence |
| `/api/style` | `style.ts` | Vision analysis, style profile, wardrobe CRUD |
| `/api/travel` | `travel.ts` | Flight search (Amadeus), hotel search (Amadeus + Google Places), POI search, flight booking proxy |
| `/api/fitness` | `fitness.ts` | Studio search (Google Places + Mindbody enrichment) |
| `/api/lifestyle` | `lifestyle.ts` + `lifestyle-booking.ts` | Restaurant/cafe discovery, browser/API booking, Resy integration |
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

### Booking Flows (Flight, Fitness, Lifestyle)

All three booking flows share the same pattern:
1. Frontend collects user info → `POST /api/{domain}/book` → Express proxy → Python sidecar
2. Sidecar returns `{jobId, status: "queued"}` immediately
3. Frontend polls `GET /api/{domain}/book/:jobId/status` every 2s
4. 4-phase modal: info → confirm → progress → result

**Flight** — `flight_bookings` table (migration 013), 2min timeout, calendar integration
**Fitness** — `fitness_bookings` table (migration 011), `booking_paths` learning (migration 014)
**Lifestyle** — `lifestyle_bookings` table (migration 015), API-first routing (Resy ~2s via HTTP, others via browser)

### Lifestyle Booking — API-First Architecture

The lifestyle booker (`lifestyle_booker.py`) tries direct API calls before browser automation:
1. `api_clients/router.py` checks if the venue domain has a direct API client (currently: `resy.com`)
2. If API available: `resy_client.py` handles search → availability → slot details → book via HTTP (~2s)
3. If API unavailable or returns `LOGIN_REQUIRED`: falls through to `browser-use` automation with CDP
4. Browser automation uses 4-layer prompt (identity → navigation → site hints → result keywords)
5. `site_memory.py` learns navigation patterns; `booking_paths` DB table stores learned steps per domain

**Resy API client** (`api_clients/resy_client.py`):
- Static API key + user JWT auth (`X-Resy-Auth-Token` / `X-Resy-Universal-Auth`)
- Tokens persisted in `profiles/{user_id}/resy_tokens.json`
- Endpoints: login (`POST /4/auth/password`), search (`POST /3/venuesearch/search`), find slots (`POST /4/find`), details (`POST /3/details`), book (`POST /3/book`)
