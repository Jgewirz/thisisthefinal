# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GirlBot** — a mobile-first AI lifestyle chat app built with React + Vite (frontend) and Express (backend). Users interact with four specialized GPT-4o-powered agents through a Telegram-inspired dark-themed UI:

- **The Stylist** (Style) — fashion, color analysis, wardrobe, outfit rating, selfie analysis (supports vision)
- **The Voyager** (Travel) — flights, hotels, trip planning
- **The Trainer** (Fitness) — workouts, gym/studio discovery
- **The Curator** (Lifestyle) — general chat, reminders, daily planning (also handles "All" tab)

## Commands

```bash
npm run dev        # Vite frontend dev server (port 5173)
npm run server     # Express API server with tsx watch (port 3001)
npm run dev:all    # Both concurrently
npm run build      # Production build to dist/
```

No test runner or linter is configured. The only required env var is `OPENAI_API_KEY` in `.env`.

## Architecture

### Frontend (src/)
- **Vite + React 18 + TypeScript** with Tailwind CSS v4 and shadcn/ui components
- **Routing**: React Router v7 — 5 routes (`/`, `/style`, `/travel`, `/fitness`, `/lifestyle`), each rendering `ChatView` with a different `agentId`
- **State**: Zustand stores — `chat.ts` (per-agent message arrays + streaming state), `style.ts` (persisted to localStorage via Zustand persist)
- **API layer** (`src/lib/api.ts`): `sendMessage()` streams chat via SSE, `runStyleAnalysis()` runs parallel vision analysis for the Style agent
- **Path alias**: `@` maps to `./src`

### Backend (server/)
- **Express on port 3001**, proxied from Vite dev server at `/api`
- **POST /api/chat** — SSE streaming endpoint. Builds agent-specific system prompt, streams GPT-4o response as `data: {"token": "..."}` events
- **POST /api/style/analyze** — GPT-4o vision endpoint for structured image analysis (skin tone, outfit rating, clothing tagging)
- **GET/POST /api/style/profile** — in-memory style profile store (not persisted across restarts)
- **Agent configs** (`server/config/agents.ts`): system prompts, model settings, vision support flags. `buildSystemPrompt()` injects `{{STYLE_PROFILE}}` placeholder for the Stylist

### Message Flow
1. User types in `ChatInput` → `ChatView.handleSend` → `api.ts:sendMessage()`
2. Adds user message + empty bot placeholder to Zustand store, sets `isStreaming=true`
3. Fetches `POST /api/chat` (proxied to Express)
4. Server streams tokens via SSE → client reads with `readStream()` → `store.appendToLastBot()` per token
5. For Style agent + image: parallel `POST /api/style/analyze` → returns structured data → attaches `RichCard` to bot message
6. `MessageBubble` renders the appropriate card component based on `richCard.type`

### Rich Card Types
Cards are rendered by `MessageBubble` based on `richCard.type`: `colorSeason` (ColorSeasonCard), `outfit` (inline OutfitRatingCard), `flight` (FlightCard), `place` (PlaceCard), `fitnessClass` (FitnessClassCard).

### Design System
- CSS custom properties defined in `src/styles/theme.css` (color tokens per agent, typography)
- Fonts: DM Sans (headings) + Work Sans (body)
- Agent-specific accent colors via `--accent-style`, `--accent-travel`, etc.

## Key Conventions

- The `"all"` agent ID routes to `lifestyle` on the backend (`getAgentConfig` falls back to lifestyle)
- Each agent has strict scope boundaries — agents redirect off-topic questions to the appropriate specialist
- Only the Style agent supports vision (image analysis)
- Style profile is dual-stored: localStorage (client, durable) + in-memory Map (server, ephemeral)
- SSE format: `data: {"token": "..."}\n\n` for streaming, `data: {"error": "..."}\n\n` for errors
