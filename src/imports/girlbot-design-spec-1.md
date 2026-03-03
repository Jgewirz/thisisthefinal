# GirlBot — Figma Make Design Prompt

## Overview

Design a mobile-first chat application UI for **GirlBot**, a Telegram-based AI stylist and lifestyle assistant. The layout follows a **tabbed sidebar + chat panel** pattern (reference: a multi-agent Telegram interface with a vertical icon rail on the left and rich message cards in the chat area). The app routes conversations to domain-specific AI agents — **Style, Travel, Fitness, and Lifestyle** — each with its own tab, icon, and visual identity within a unified dark-themed shell.

---

## Global Design System

### Theme & Mood
- **Base theme:** Dark mode (rich charcoal/near-black background, `#1A1A2E` or `#0F0F1A`)
- **Accent palette:** Warm rose-gold (`#E8A0BF`) as primary accent, with per-agent accent colors (see below)
- **Vibe:** Luxe-feminine meets functional — a high-end beauty app crossed with a power-user messaging tool. Not cutesy; sophisticated, confident, body-positive
- **Typography:** Use a refined sans-serif display font (e.g., **Poppins** or **DM Sans** for headings) paired with a clean body font (**Nunito Sans** or **Work Sans**). Avoid generic system fonts

### Color Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-primary` | `#0F0F1A` | App background |
| `--bg-surface` | `#1A1A2E` | Cards, sidebar, chat bubbles (bot) |
| `--bg-surface-elevated` | `#252542` | Active tab, hover states |
| `--text-primary` | `#F0ECF4` | Main text |
| `--text-secondary` | `#9D95A8` | Timestamps, metadata |
| `--accent-global` | `#E8A0BF` | Primary CTA, active indicators |
| `--accent-style` | `#E8A0BF` | Style agent — rose-gold/blush |
| `--accent-travel` | `#7EC8E3` | Travel agent — sky blue |
| `--accent-fitness` | `#A8E6CF` | Fitness agent — fresh mint |
| `--accent-lifestyle` | `#FFD580` | Lifestyle/Chat agent — warm amber |
| `--user-bubble` | `#2D2B55` | User message bubbles |
| `--bot-bubble` | `#1E1E38` | Bot message bubbles |
| `--success` | `#4ADE80` | Confirmations, bookings |
| `--warning` | `#FBBF24` | Budget alerts, reminders |
| `--error` | `#F87171` | Errors, cancellations |

### Iconography
- Use a consistent outlined icon set (Lucide or Phosphor style)
- Each agent tab gets a distinctive icon:
  - **Style** — Palette or sparkle icon
  - **Travel** — Airplane or compass icon
  - **Fitness** — Dumbbell or heart-pulse icon
  - **Lifestyle** — Coffee cup or chat-smile icon
- Active tab icon fills with its accent color; inactive tabs use `--text-secondary`

---

## Layout Structure

### A) Left Sidebar — Agent Tab Rail

A narrow vertical strip (56–64px wide) pinned to the left edge. Modeled after the vertical icon sidebar in the reference screenshot where agents like "Outreach", "Personal/Life", "Brain", "Analytics" etc. are stacked as icon tabs.

**Contents (top to bottom):**

1. **GirlBot logo/avatar** at top — a small circular mark or monogram "G" in rose-gold
2. **Divider line** (subtle, 1px, `--bg-surface-elevated`)
3. **Agent tabs** — vertically stacked icon buttons, one per agent domain:
   - **All** (unified feed icon — grid or inbox) — shows all conversations across agents
   - **Style** (palette/sparkle) — color analysis, outfit feedback, wardrobe, makeup
   - **Travel** (airplane/compass) — flights, hotels, itinerary, destination discovery
   - **Fitness** (dumbbell/heart-pulse) — gym search, class finder, workout recs
   - **Lifestyle** (coffee/chat) — general chat, schedule, reminders, wellness check-ins
4. **Divider line**
5. **Utility icons** at bottom:
   - **Settings** (gear icon)
   - **Profile** (user avatar thumbnail)

**Tab states:**
- **Active:** Left-edge accent bar (3px, agent's accent color) + filled icon in accent color + label visible
- **Inactive:** Outlined icon in `--text-secondary`, no label
- **Hover:** Icon brightens, subtle tooltip with agent name
- **Unread:** Small dot badge in the agent's accent color
- Each tab filters the chat list to only show conversations from that agent domain

**Expanded state (tablet/desktop):**
- Sidebar widens to ~200px showing icon + label for each tab
- Labels: "All", "Style", "Travel", "Fitness", "Lifestyle"
- Each label row also shows an unread message count badge

---

### B) Conversation List Panel (Middle Column — Desktop Only)

On desktop/tablet (>=768px), a second column (280–320px wide) appears between sidebar and chat. On mobile, this replaces the chat view with standard drill-down navigation.

**Header:**
- Agent name + icon in that agent's accent color (e.g., "Travel" in sky blue)
- Search bar (pill-shaped, ghost style)
- Filter chips: "Active", "Planned", "Completed" (for Travel); "Outfits", "Wardrobe", "Makeup" (for Style)

**Conversation cards:**
Each card shows:
- **Agent avatar** — small circular icon in agent accent color
- **Conversation title** — auto-generated from context (e.g., "Lisbon Trip Planning", "Spring Outfit Ideas", "Yoga Studios Near Me")
- **Last message preview** — truncated, 1 line
- **Timestamp** — relative ("2h ago", "Yesterday")
- **Status indicator** — for Travel: planning/booked/completed badge; for Fitness: upcoming/past

**Visual treatment:**
- Active conversation: highlighted with `--bg-surface-elevated` + left accent bar
- Cards have subtle bottom border separators
- Swipe actions (mobile): archive left, pin right

---

### C) Main Chat Panel (Right / Primary View)

The primary interaction area — full-width on mobile, right column on desktop.

**Chat Header Bar:**
- Back arrow (mobile only)
- Agent icon + bot name. Use "GirlBot" with a subline showing active domain: "Style Agent" / "Travel Agent" / etc. — similar to how the reference shows "007" as the bot name with context
- Right side: search icon, overflow menu (three dots)

**Message Bubbles:**

*User messages (right-aligned):*
- Background: `--user-bubble` (`#2D2B55`)
- Text: `--text-primary`
- Rounded corners (16px, sharp bottom-right)
- Timestamp below, right-aligned, `--text-secondary`
- Double-check delivery indicator (Telegram-style)

*Bot messages (left-aligned):*
- Background: `--bot-bubble` (`#1E1E38`)
- Text: `--text-primary`
- Rounded corners (16px, sharp bottom-left)
- **Agent identifier tag** at top of first bubble in a thread — small colored pill badge: "Style" in rose-gold, "Travel" in sky blue, etc.
- Timestamp below, left-aligned

---

## Rich Content Cards (Embedded in Bot Messages)

These structured cards are the key differentiator — actionable data embedded within chat bubbles. Design each as a reusable component.

### 1. Place / Business Card (Travel & Fitness agents)
Mirrors the reference screenshot's Mercedes-Benz card format:
- Location pin icon + **Business name** (bold, white)
- Phone number with tap-to-call icon
- Website URL (tappable, in agent accent color)
- Star rating row (if available)
- Action button row: "Schedule" / "Call" / "Directions"
- **Link preview card** below — bordered sub-card showing site favicon, page title, and description snippet (exactly like the Telegram URL preview in the reference)

### 2. Flight Option Card (Travel agent)
- Airline logo + name
- Departure city/time → Arrival city/time (with arrow graphic)
- Duration + number of stops
- Price (large text, in `--accent-travel`)
- "Select" pill button
- Present in tiered sets of 3: Budget / Balanced / Premium — each with a subtle tier label

### 3. Hotel Option Card (Travel agent)
- Hotel photo (wide, rounded top corners)
- Hotel name + star rating
- Price per night
- Key amenities as small icon chips (wifi, pool, gym)
- "Book" / "Details" pill buttons
- Style-match tag if applicable: "Matches your romantic aesthetic" in a subtle accent pill

### 4. Outfit Feedback Card (Style agent)
- User's uploaded photo (large, rounded)
- Color harmony score shown as a circular progress ring
- Pros and cons as icon-labeled items
- "Add to Wardrobe" pill button

### 5. Color Season Result Card (Style agent)
- Season name displayed large and bold (e.g., "True Autumn")
- Color swatch row: 6–8 circular color dots showing the user's best colors
- Subtitle: "Your best metals: Gold, Copper"
- Expandable section: "See full palette"

### 6. Fitness Class Card (Fitness agent)
- Studio name + class type header
- Date and time
- Distance from user
- "Book" / "Directions" pill buttons

### 7. Reminder Confirmation (Cross-agent)
Mirrors the reference's "Done. I'll remind you tomorrow at 10 AM to book it" pattern:
- Checkmark icon + confirmation text
- Scheduled time displayed
- Contextual emoji (car for appointments, yoga pose for classes, plane for travel)

---

## Action Buttons & Interactions

**Inline action buttons** below bot messages (Telegram inline keyboard style):
- Pill-shaped, outline style with agent accent color border
- Hover/tap state: fills with accent color, text color inverts to dark
- Examples: "Set a reminder to book this", "Show more options", "Add to wardrobe", "Compare flights"

**Reactions:**
- Heart reaction overlay on bot messages (mirroring the heart-react in the reference)
- Tap-and-hold to show reaction picker

**Quick-action chips** above the input area, changing per active agent:
- **Style:** "Analyze my colors", "Rate my outfit", "Wardrobe check"
- **Travel:** "Plan a trip", "Find flights", "Hotel search"
- **Fitness:** "Studios near me", "Yoga classes", "Gym finder"
- **Lifestyle:** "Set reminder", "My schedule", "Wellness check"

---

## Chat Input Area (Bottom Bar)

- Text input field: dark background, fully rounded, placeholder text "Ask GirlBot anything..."
- Left icons: attachment/camera icon (for photos — critical for Style agent), location pin icon (for Fitness/Travel)
- Right: circular send button with arrow icon in `--accent-global`
- Quick-action chips row sits directly above the input bar

---

## Date Headers

- Centered in the chat flow as rounded pill badges
- Background: `--bg-surface-elevated`
- Text: `--text-secondary`
- Examples: "February 25", "March 2", "Today"
- Same visual treatment as the reference screenshot's date separators

---

## Screen States to Design

### Screen 1 — Mobile: Style Agent Chat
Full-screen chat. Header: "GirlBot · Style". User sent a selfie photo. Bot responds with a **Color Season Result Card** showing "True Autumn" with color swatches. Below the card: inline buttons "See makeup tips", "Best outfit colors", "Add to profile".

### Screen 2 — Mobile: Travel Agent Chat
Full-screen chat. Header: "GirlBot · Travel". User: "I got to book Mercedes appointment in coconut grove" (matching the reference flow). Bot responds with a **Place Card** showing Mercedes-Benz of Miami — name, phone `(305) 707-0147`, website link, plus a link preview card. Below: "Set a reminder to book this" button. Next message — Bot: "Done. I'll remind you tomorrow at 10 AM to book it." with a car emoji and checkmark.

### Screen 3 — Mobile: Fitness Agent Chat
Full-screen chat. Header: "GirlBot · Fitness". User: "Find yoga near me". Bot shows 3 **Fitness Class Cards** stacked vertically — each with studio photo, class name, time, distance, and "Book" / "Directions" buttons.

### Screen 4 — Desktop: Full Three-Column Layout
All three columns visible: Sidebar (agent tab rail with Travel tab active, highlighted in sky blue) | Conversation List (showing Travel conversations: "Lisbon Trip", "Miami Flights", "Hotel Search" — with status badges) | Active Chat (Travel conversation showing **Flight Option Cards** in Budget/Balanced/Premium tiers).

### Screen 5 — Mobile: Agent Tab Switcher
Bottom sheet or slide-out drawer showing the agent tabs as larger cards. Each card: agent icon, agent name, 1-line description, and unread count. User taps to switch agent context.

### Screen 6 — Empty State / Onboarding
Chat area shows a centered onboarding illustration with:
- "Hey gorgeous! I'm GirlBot"
- "Send me a selfie to discover your color season, or tell me what you need"
- Quick-start buttons: "Analyze my colors", "Plan a trip", "Find a class", "Just chat"

### Screen 7 — Settings Screen
Dark card-based layout:
- Profile section (name, avatar, color season badge if known)
- Feature toggles for each agent (Style on, Travel on, Fitness on)
- Connected accounts section
- Notification preferences
- "Clear conversation" with confirmation dialog

---

## Agent Routing Transition

When the user sends a message that triggers a domain switch (e.g., mid-style-chat they say "find me a flight to Lisbon"), show a **routing animation**: a small pill slides in at the top of the chat area — "Switching to Travel" in sky blue — then fades out after 2 seconds. The header updates to reflect the new active agent.

---

## Typing Indicator

Three animated dots inside a bot-style bubble. The dots pulse in the active agent's accent color.

---

## Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| **< 640px** (Mobile) | Single column. Sidebar hidden; replaced by a bottom tab bar with 5 icons (All, Style, Travel, Fitness, Lifestyle). Chat is full screen. Conversation list via back navigation. |
| **640–1024px** (Tablet) | Two columns: collapsed sidebar (icon-only, 56px) + chat panel. Conversation list via hamburger or swipe gesture. |
| **> 1024px** (Desktop) | Three columns: expanded sidebar (200px with labels) + conversation list (300px) + chat panel (remaining width). |

---

## Component Library Checklist

Generate all of these as reusable Figma components with variants:

- [ ] Agent Tab (active / inactive / unread states × 5 agents)
- [ ] Sidebar Rail (collapsed 56px + expanded 200px variants)
- [ ] Conversation List Card (default / active / unread)
- [ ] Chat Bubble — User (text only / with photo / with location)
- [ ] Chat Bubble — Bot (text only / with agent badge)
- [ ] Rich Card — Place/Business (with link preview sub-card)
- [ ] Rich Card — Flight Option (with tier label)
- [ ] Rich Card — Hotel Option (with style-match tag)
- [ ] Rich Card — Outfit Feedback (with color harmony ring)
- [ ] Rich Card — Color Season Result (with swatch row)
- [ ] Rich Card — Fitness Class
- [ ] Rich Card — Reminder Confirmation
- [ ] Link Preview Card (URL embed)
- [ ] Inline Action Button Row
- [ ] Quick Action Chips (per-agent variants)
- [ ] Date Separator Pill
- [ ] Chat Input Bar (with attachment + location + send)
- [ ] Typing Indicator (with agent color variant)
- [ ] Agent Routing Transition Pill
- [ ] Empty State / Onboarding
- [ ] Reaction Overlay (heart)
- [ ] Unread Badge Dot
- [ ] Settings Card
- [ ] Bottom Tab Bar (mobile variant of sidebar)

---

## Design Deliverables

1. **Mobile screens** (375×812): All 7 screen states described above
2. **Desktop screen** (1440×900): Full three-column layout with active Travel agent
3. **Component library page**: All components organized by category with variant states
4. **Color and typography styles**: Registered as Figma styles using the token names from the color table
5. **Prototype flow**: Tap agent tab → see filtered conversation list → open chat → send message → receive rich card response → tap action button → see confirmation