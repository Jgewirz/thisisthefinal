# Booking Agent Diagnosis — SoulCycle

## Root Causes Found

### Issue 1: Generic prompt doesn't know SoulCycle's booking flow (CRITICAL)
**Where**: `fitness_booker.py:build_fitness_task_prompt()`

The LLM task prompt was completely generic — it told the agent to "find the schedule, click the booking button, fill in a registration form, submit." SoulCycle's flow is fundamentally different:

- **Reserve** (not "register")
- **Bike selection** (visual grid map — unique to cycling studios)
- **Credit/pack system** (not a simple form submission)
- **No registration form** — SoulCycle uses account-based booking, not per-class registration

The agent would find classes on the schedule, see "Reserve" buttons, but either:
1. Think the task was "done" after finding classes (prompt didn't distinguish finding vs booking)
2. Get confused by the bike map step (not mentioned in the prompt)
3. Get blocked by the "Do NOT click Pay/Purchase/Buy" constraint when trying to use credits

**Fix**: Added `SOULCYCLE_CONTEXT` with detailed step-by-step instructions for the Reserve → Bike → Credit → Confirm flow. Added `detect_site_type()` to select site-specific context.

### Issue 2: Success criteria too vague (CRITICAL)
**Where**: `fitness_booker.py:build_fitness_task_prompt()` — success criteria section

The prompt said "Report CLASS_BOOKED if successfully registered." The LLM could interpret "finding classes" as completing the task. The new prompt explicitly states:

> "SUCCESS CRITERIA — you must reach a BOOKING CONFIRMATION to report CLASS_BOOKED.
> Just finding a class on the schedule is NOT success — you must complete the reservation."

### Issue 3: Credit usage blocked by payment constraint (HIGH)
**Where**: `fitness_booker.py` line 119-121 (old prompt)

The constraint "Do NOT click Pay, Purchase, Buy, or Checkout" was too broad. SoulCycle uses a credit system where clicking "Confirm" to use a pre-purchased credit is NOT a payment — it's using an existing balance. The agent would see a "Complete Reservation" or "Confirm" button and think it was a payment.

**Fix**: Clarified the constraint:
- Entering credit card numbers → STOP, report PAYMENT_REQUIRED
- Using existing credits/class pack → OK, proceed
- Clicking "Confirm" to use a pre-purchased credit → OK

### Issue 4: Not enough steps for multi-step flows (MEDIUM)
**Where**: `fitness_booker.py:run_fitness_booking()` — `max_steps=15`

SoulCycle's flow requires: navigate → handle popup → login → studio selection → date navigation → class selection → click reserve → bike selection → confirmation = ~9-12 meaningful steps. With overhead (page loads, scrolling, waiting), 15 steps was borderline.

**Fix**: `max_steps=25` for SoulCycle (detected via `detect_site_type()`), 20 for generic sites.

### Issue 5: Timeout too short (MEDIUM)
**Where**: `fitness_booker.py` — `BOOKING_TIMEOUT=150`
**Where**: `FitnessClassBookingFlow.tsx` — polling timeout `150000`

SoulCycle's SPA is slow — each page transition takes 2-5 seconds. With 25 steps at ~5 seconds each plus LLM inference time, 150s was tight.

**Fix**: `BOOKING_TIMEOUT=180` (Python), polling timeout `210000` (3.5 minutes, React).

### Issue 6: No debug screenshots (LOW but critical for diagnosis)
**Where**: `fitness_booker.py:run_fitness_booking()`

No screenshots were saved during the run, making it impossible to see where the agent got stuck. There was no `debug/` directory.

**Fix**: Added `on_step_end` callback that saves a screenshot at every step to `debug/{job_id}/step_XX.png`. Also saves a `final.png` after completion.

### Issue 7: "See schedule" placeholder data (LOW)
**Where**: `server/routes/fitness.ts` — class card generation

When the enricher can't extract specific class times (SPA websites), the class card has `time: "See schedule"` and `instructor: "See schedule"`. The agent receives this literally.

**Fix**: Added handling in the prompt — when time/instructor is "See schedule", the agent browses the schedule and picks the first available matching class.

## Files Modified

| File | Changes |
|------|---------|
| `booking-agent/fitness_booker.py` | SoulCycle-specific context, site detection, debug screenshots, better prompts, more steps/timeout |
| `booking-agent/test_soulcycle_booking.py` | NEW — standalone test script with debug output |
| `booking-agent/debug/` | NEW — screenshot output directory |
| `server/routes/fitness.ts` | `class_full` result handling, synthetic class cards for website-only studios |
| `src/app/components/FitnessClassBookingFlow.tsx` | `class_full` UI state, longer polling timeout |

## Testing

```bash
# Run SoulCycle test with visible browser
cd booking-agent
python test_soulcycle_booking.py --headless false --studio miami-beach --date 2026-03-26

# Check debug screenshots
ls debug/test_*/

# Run via the full app
npm run dev:all
# Chat: "find me cycling classes at soulcycle"
# Click "Book Class" on a card
```
