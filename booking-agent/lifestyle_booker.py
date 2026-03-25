"""Universal booking agent for lifestyle services — restaurants, salons, spas, nails."""

import asyncio
import os
import time
from pathlib import Path
from browser_use.agent.service import Agent
from browser_use.llm.openai.chat import ChatOpenAI
from job_store import store
from booking_browser import create_browser_session, launch_chrome_with_cdp, BROWSER_HEADLESS
from browser_utils import (
    kill_stale_browsers, clear_profile_lock, find_available_debug_port,
    set_browser_launch_timeout, check_url_reachable, get_homepage_url,
)
from site_memory import (
    load_profile, learn_from_attempt, format_profile_for_prompt, extract_domain,
    extract_inline_observations, merge_inline_observations,
)
from auth_session import (
    load_user_session, check_session_health, mark_studio_session,
    invalidate_studio_session,
)
from fitness_booker import extract_navigation_steps
from api_clients.router import route_lifestyle_booking

BROWSER_STARTUP_TIMEOUT = int(os.getenv("BROWSER_STARTUP_TIMEOUT", "90"))
set_browser_launch_timeout(BROWSER_STARTUP_TIMEOUT)

BOOKING_TIMEOUT = int(os.getenv("LIFESTYLE_BOOKING_TIMEOUT", "300"))
BROWSER_MAX_LAUNCH_RETRIES = int(os.getenv("BROWSER_MAX_LAUNCH_RETRIES", "2"))
DEBUG_DIR = Path(os.getenv("BOOKING_DEBUG_DIR", "./debug"))
DEBUG_DIR.mkdir(parents=True, exist_ok=True)


def build_lifestyle_prompt(
    booking_data: dict,
    user_info: dict,
    known_steps: list | None = None,
    site_profile=None,
    auth_status: str = "never_logged_in",
) -> str:
    """Build a universal lifestyle booking prompt with 4 layers."""
    booking_type = booking_data.get("bookingType", "restaurant")
    venue_name = booking_data.get("venueName", "")
    venue_website = booking_data.get("venueWebsite", "") or booking_data.get("bookingUrl", "")
    booking_url = booking_data.get("bookingUrl", "") or venue_website
    booking_date = booking_data.get("date", "")
    booking_time = booking_data.get("time", "")
    party_size = booking_data.get("partySize", 2)
    service_type = booking_data.get("serviceType", "")
    stylist = booking_data.get("stylist", "")
    duration = booking_data.get("duration", "")
    special_requests = booking_data.get("specialRequests", "")
    user_city = booking_data.get("userCity", "")
    user_region = booking_data.get("userRegion", "")

    first_name = user_info.get("firstName", "")
    last_name = user_info.get("lastName", "")
    email = user_info.get("email", "")
    phone = user_info.get("phone", "")
    google_email = user_info.get("googleEmail", email)

    has_google_session = auth_status in ("google_active", "studio_active") or user_info.get("hasGoogleSession", False)

    # Type-specific target details
    if booking_type == "restaurant":
        target_details = f"""- Booking type: Restaurant reservation
- Restaurant: {venue_name}
- Date: {booking_date}
- Time: {booking_time}
- Party size: {party_size} guests
{f'- Special requests: {special_requests}' if special_requests else ''}"""
    elif booking_type in ("salon", "nails"):
        target_details = f"""- Booking type: {booking_type.title()} appointment
- Venue: {venue_name}
- Service: {service_type or 'Any available'}
{f'- Preferred stylist: {stylist}' if stylist and stylist != 'Any' else ''}
- Date: {booking_date}
- Time: {booking_time}
{f'- Duration: {duration}' if duration else ''}
{f'- Special requests: {special_requests}' if special_requests else ''}"""
    else:  # spa, selfcare, generic
        target_details = f"""- Booking type: {booking_type.title()} appointment
- Venue: {venue_name}
- Service: {service_type or 'Any available'}
- Date: {booking_date}
- Time: {booking_time}
{f'- Duration: {duration}' if duration else ''}
{f'- Special requests: {special_requests}' if special_requests else ''}"""

    user_city_display = user_city or ""
    if user_region:
        user_city_display = f"{user_city}, {user_region}" if user_city else user_region

    location_note = f"- User's city/region: {user_city_display}" if user_city_display else ""

    # Authentication block (same pattern as fitness)
    if has_google_session:
        auth_block = f"""
AUTHENTICATION — YOU ARE ALREADY LOGGED IN (most likely):
The user has previously signed into this website. Their session cookies
are saved in this browser. You should be able to book without any login.

  STEP 1 — VERIFY LOGGED-IN STATE:
     Look for ANY of these indicators that the user is signed in:
     - A user name, initials, avatar, or profile photo in the header/nav bar
     - Links like "My Account", "Profile", "My Reservations", "My Appointments"
     - A greeting like "Welcome", "Hi [Name]", or "Hello [Name]"
     - The ABSENCE of "Sign In", "Log In", or "Create Account" buttons

     Common patterns across booking sites:
     - Resy: user avatar or name in top-right, "Your Reservations" link
     - OpenTable: profile icon, "My Dining History" or "Upcoming Reservations"
     - Vagaro: "My Appointments" in nav, or account dropdown
     - Booksy: profile icon, upcoming appointments badge
     - Square Appointments: account menu, "My Bookings"

     If you see ANY of these signs -> you ARE logged in -> proceed to PHASE 3.
     Do NOT click "Sign In" or navigate to a login page if you're already logged in.

  STEP 2 — IF NOT LOGGED IN:
     - DO NOT type any credentials, passwords, or emails
     - DO NOT click "Continue with Google" or any SSO buttons
     - DO NOT try to create a new account
     - Report LOGIN_REQUIRED immediately with:
       LOGIN_URL: <the exact URL of the login page you see>
       AUTH_OPTIONS: <list what login methods the site offers>
     The user will sign in manually and retry.

IMPORTANT: If you get redirected to a login page while booking, the session expired.
Report LOGIN_REQUIRED immediately. Do not attempt to re-authenticate.
"""
    else:
        auth_block = f"""
AUTHENTICATION — CHECK IF LOGGED IN:
  1. Look for signs you're already logged in:
     - User name/avatar/initials in the header or nav bar
     - "My Account", "Profile", "My Reservations" links
     - Absence of "Sign In" / "Log In" buttons
     If logged in -> proceed directly to booking.

  2. If NOT logged in (login page, "Sign In" button visible):
     - DO NOT type credentials, click Google SSO, or create accounts
     - Report LOGIN_REQUIRED immediately with:
       LOGIN_URL: <the login page URL>
       AUTH_OPTIONS: <what login methods the site offers>
     The user will sign in manually via a real browser and retry.
"""

    # ── LAYER 1 ──
    layer1 = f"""You are a universal booking agent. Your goal is to COMPLETE a booking on ANY website.
Finding the booking page is NOT enough -- you must go through the ENTIRE booking flow until you see a confirmation.

TARGET: Book at {venue_name}
{target_details}
- Website: {booking_url}
{location_note}

USER INFO (for any forms):
- Name: {first_name} {last_name}
- Email: {email}
{f'- Phone: {phone}' if phone else ''}

{auth_block}"""

    # ── LAYER 2: Universal Navigation Method ──
    layer2 = """
UNIVERSAL NAVIGATION METHOD:
Follow these 6 phases in order. Adapt to whatever the website presents.

PHASE 1 — ORIENT:
- Navigate to the venue website URL
- If you see a 404, "Page Not Found", or error page, go to the site's homepage instead
- Dismiss any popups, cookie banners, promotional overlays, or newsletter signups
- Identify the site layout: look for "Reserve", "Book", "Appointments", "Schedule" links
- If the site has a location/city picker, set it to the user's city/region FIRST

PHASE 2 — AUTHENTICATE (if required):
- Check if you're already logged in (user avatar, account menu, "Welcome [name]")
- If already logged in, skip auth entirely and proceed to Phase 3
- If not logged in and the site requires it, follow the AUTHENTICATION instructions above
- NEVER type passwords or create accounts — use saved session or report back

PHASE 3 — FIND BOOKING FORM:
- Look for "Reserve", "Book Now", "Book a Table", "Book Appointment", "Schedule" buttons
- Detect the platform type:
  * Resy widget (embedded reservation widget with date/time/party picker)
  * OpenTable widget (date/time/party size selector, "Find a Table" button)
  * Vagaro/Booksy (service type selector, stylist picker, calendar)
  * Square Appointments (service + time slot selector)
  * Direct form (custom booking form on the venue's own website)
- If the site redirects to a third-party booking platform, follow the redirect
- Wait for dynamic content to load (SPAs may take 3-5 seconds)

PHASE 4 — SELECT DATE/TIME:
- For restaurants: Set party size, navigate calendar/date picker, select time slot
- For salons/spas: Select service type first, then stylist (if applicable), then date/time
- Navigate the calendar using arrows, date tabs, or date picker to the target date
- Select the closest available time slot to the requested time
- If the exact time isn't available, pick the nearest option and note it in your report

PHASE 5 — COMPLETE BOOKING:
- Fill guest/client name, email, phone from user info
- Enter any special requests or notes if there's a field for them
- Check required boxes (terms, agreements, cancellation policy)
- Click the final "Confirm", "Complete Reservation", "Book Appointment" button
- If a payment form with credit card fields appears, STOP and report PAYMENT_REQUIRED
- If redirected to a purchase page (buy credits, deposit required), report PAYMENT_REQUIRED
- Wait for and capture the confirmation page/message

PHASE 6 — HANDLE OBSTACLES:
- If stuck on the same page for 3+ steps, try refreshing once
- If a page appears blank, wait 3-5 seconds then scroll to trigger lazy loading
- If stuck repeating the same action 3+ times, try a different approach
- Maximum 3 wait-and-retry cycles on any single page before trying a different route
- If the site has an unsolvable CAPTCHA, report BLOCKED"""

    # ── LAYER 3: Site-Specific Hints ──
    layer3_parts = []

    if site_profile:
        profile_text = format_profile_for_prompt(site_profile)
        if profile_text:
            layer3_parts.append(profile_text)

    if known_steps:
        step_descriptions = []
        for s in known_steps:
            desc = f"  {s.get('step', '?')}. {s.get('goal', '')} (action: {s.get('action', 'unknown')})"
            if s.get('url'):
                desc += f" -> URL: {s['url']}"
            step_descriptions.append(desc)
        layer3_parts.append(f"""
PREVIOUS NAVIGATION PATH (from a prior successful booking at this site):
Follow these steps as a shortcut, but adapt if the website has changed:
{chr(10).join(step_descriptions)}""")

    layer3 = "\n".join(layer3_parts) if layer3_parts else ""

    # ── LAYER 4: Reporting Format ──
    layer4 = """
SUCCESS CRITERIA — you must reach a BOOKING CONFIRMATION to report RESERVATION_CONFIRMED.
Just finding the booking form is NOT success — you must complete the reservation.

REPORT your final status using EXACTLY one of these keywords:
- RESERVATION_CONFIRMED — successfully completed the booking (include confirmation details)
- PAYMENT_REQUIRED — booking requires a deposit or prepayment (credit card needed)
- NO_AVAILABILITY — no slots available for the requested date/time
- LOGIN_REQUIRED — login needed but not already logged in.
  Include: LOGIN_URL: <the login page URL>, AUTH_OPTIONS: <what login methods the site offers>
- BLOCKED — site blocked automation or has unsolvable CAPTCHA
- ERROR — something else went wrong (describe what happened)

Include any confirmation number, booking reference, reservation time, or success message.

SITE OBSERVATIONS (fill this out at the end of your response for learning):
After reporting your status, add a section starting with "=== SITE OBSERVATIONS ===" containing:
- What type of platform/framework the site uses
- How authentication works
- How the booking flow is organized
- Any obstacles you encountered
- Tips for navigating this site faster next time"""

    return f"{layer1}\n{layer2}\n{layer3}\n{layer4}"


async def run_lifestyle_booking(
    job_id: str,
    booking_data: dict,
    user_info: dict,
    known_steps: list | None = None,
) -> None:
    """Run the booking agent for a lifestyle venue. API-first, browser fallback."""

    # ── API-first: try direct API if available (Resy = ~2 seconds) ──
    try:
        await store.update_status(job_id, "navigating", "Checking for fast booking path...")
        api_result = await route_lifestyle_booking(booking_data, user_info, job_id, known_steps)
        if api_result is not None:
            status = api_result.get("status", "ERROR")
            print(f"[lifestyle_booker] API booking result: {status}")

            if status == "RESERVATION_CONFIRMED":
                await store.set_result(job_id, {
                    "status": "booked",
                    "message": api_result.get("message", "Reservation confirmed via API"),
                    "confirmationCode": api_result.get("confirmation_code", ""),
                    "venueWebsite": booking_data.get("venueWebsite", ""),
                    "bookingMethod": api_result.get("booking_method", "api"),
                    "time": api_result.get("time", ""),
                    "navigationSteps": [],
                })
                return
            elif status == "NO_AVAILABILITY":
                await store.set_result(job_id, {
                    "status": "no_availability",
                    "message": api_result.get("message", "No availability"),
                    "venueWebsite": booking_data.get("venueWebsite", ""),
                    "bookingMethod": "api",
                    "navigationSteps": [],
                })
                return
            elif status == "PAYMENT_REQUIRED":
                await store.set_result(job_id, {
                    "status": "payment_required",
                    "message": api_result.get("message", "Payment required"),
                    "venueWebsite": booking_data.get("venueWebsite", ""),
                    "bookingMethod": "api",
                    "navigationSteps": [],
                })
                return
            elif status == "LOGIN_REQUIRED":
                # API needs credentials — fall through to browser automation
                print(f"[lifestyle_booker] Resy tokens missing/expired, falling back to browser")
            else:
                # Other API error — fall through to browser
                print(f"[lifestyle_booker] API returned {status}, falling back to browser")
    except Exception as api_err:
        print(f"[lifestyle_booker] API routing failed (non-fatal): {api_err}")

    # ── Browser automation fallback ──
    session = None
    job_debug_dir = DEBUG_DIR / job_id
    job_debug_dir.mkdir(parents=True, exist_ok=True)

    domain = None
    step_log: list[dict] = []
    inline_observations: dict = {}
    step_count = 0
    profile_dir_path = None

    try:
        await store.update_status(job_id, "navigating", "Opening venue website...")

        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        venue_website = booking_data.get("venueWebsite", "") or booking_data.get("bookingUrl", "")
        if venue_website:
            reachable, status = await check_url_reachable(venue_website)
            if not reachable and status and status >= 400:
                homepage = get_homepage_url(venue_website)
                print(f"[lifestyle_booker] URL returned {status}, falling back to homepage: {homepage}")
                booking_data = {**booking_data, "venueWebsite": homepage}
                venue_website = homepage

        domain = extract_domain(venue_website)
        site_profile = load_profile(domain)
        if site_profile:
            print(f"[lifestyle_booker] Loaded site profile for {domain} (confidence: {site_profile.confidence:.2f})")
        else:
            print(f"[lifestyle_booker] No site profile for {domain} -- navigating from scratch")

        user_id = user_info.get("userId")
        auth_status = "never_logged_in"
        if user_id:
            auth_status = check_session_health(user_id, domain)
            auth_session = load_user_session(user_id)
            if auth_session and auth_session.google_email:
                user_info = {**user_info, "googleEmail": auth_session.google_email}
            print(f"[lifestyle_booker] Auth status for {user_id}: {auth_status}")

        task = build_lifestyle_prompt(booking_data, user_info, known_steps, site_profile, auth_status=auth_status)

        max_steps = 25 if (site_profile and site_profile.confidence > 0.5) else 30

        async def on_step_end(agent_instance):
            nonlocal step_count
            step_count += 1

            current_url = ""
            try:
                screenshot_path = str(job_debug_dir / f"step_{step_count:02d}.png")
                screenshot_bytes = await session.take_screenshot(full_page=False)
                if screenshot_bytes:
                    Path(screenshot_path).write_bytes(screenshot_bytes)
                current_url = await session.get_current_page_url()
                print(f"[lifestyle_booker] Step {step_count}: {current_url} -> {screenshot_path}")
            except Exception as e:
                print(f"[lifestyle_booker] Screenshot failed at step {step_count}: {e}")

            step_entry = {"step": step_count, "url": current_url, "action": "", "goal": "", "memory": "", "eval": ""}
            try:
                hist_list = agent_instance.history
                if hist_list and hist_list.history:
                    last_item = hist_list.history[-1]
                    mo = getattr(last_item, 'model_output', None)
                    if mo:
                        step_entry["goal"] = getattr(mo, 'next_goal', "") or ""
                        step_entry["memory"] = getattr(mo, 'memory', "") or ""
                        step_entry["eval"] = getattr(mo, 'evaluation_previous_goal', "") or ""
                        actions = getattr(mo, 'action', None)
                        if actions:
                            if isinstance(actions, list) and actions:
                                step_entry["action"] = type(actions[0]).__name__
                            else:
                                step_entry["action"] = str(actions)[:50]
            except Exception:
                pass

            step_log.append(step_entry)

            obs = extract_inline_observations(step_entry)
            if obs:
                merge_inline_observations(inline_observations, obs, step_count)

            # Update progress status
            if step_count <= 3:
                await store.update_status(job_id, "navigating", "Navigating venue website...")
            elif step_count <= 5:
                await store.update_status(job_id, "navigating", "Handling login...")
            elif step_count <= 10:
                await store.update_status(job_id, "finding_form", "Finding booking form...")
            elif step_count <= 15:
                await store.update_status(job_id, "filling_details", "Filling in your details...")
            elif step_count <= 20:
                await store.update_status(job_id, "filling_details", "Selecting options...")
            else:
                await store.update_status(job_id, "processing", "Finalizing booking...")

        # Browser launch with retry
        result = None
        last_error = None

        for attempt in range(BROWSER_MAX_LAUNCH_RETRIES):
            try:
                if session:
                    try:
                        await session.close()
                    except Exception:
                        pass
                    session = None

                session, profile_dir_path = await create_browser_session(user_info)

                # Pre-navigate to the venue URL
                try:
                    await session.navigate_to(venue_website)
                    print(f"[lifestyle_booker] Pre-navigated to {venue_website}")
                    await asyncio.sleep(2)
                except Exception as nav_err:
                    print(f"[lifestyle_booker] Pre-navigation failed (agent will retry): {nav_err}")

                agent = Agent(
                    task=task,
                    llm=llm,
                    browser_session=session,
                )

                await store.update_status(job_id, "finding_form", "Looking for booking form...")

                result = await asyncio.wait_for(
                    agent.run(max_steps=max_steps, on_step_end=on_step_end),
                    timeout=BOOKING_TIMEOUT,
                )
                break

            except (asyncio.TimeoutError, Exception) as e:
                last_error = e
                is_browser_launch_failure = (
                    "timed out" in str(e).lower()
                    and step_count == 0
                )

                if is_browser_launch_failure and attempt < BROWSER_MAX_LAUNCH_RETRIES - 1:
                    print(f"[lifestyle_booker] Browser launch attempt {attempt + 1} failed: {e}")
                    print(f"[lifestyle_booker] Cleaning up and retrying...")
                    if profile_dir_path:
                        kill_stale_browsers(profile_dir_path)
                        clear_profile_lock(profile_dir_path)
                    else:
                        kill_stale_browsers()
                    await asyncio.sleep(2)
                    step_count = 0
                    continue
                else:
                    raise

        final_text = result.final_result() if result else "No result returned"

        await store.update_status(job_id, "processing", "Processing results...")

        # Save final screenshot
        try:
            final_bytes = await session.take_screenshot(full_page=False)
            if final_bytes:
                (job_debug_dir / "final.png").write_bytes(final_bytes)
        except Exception:
            pass

        final_str = str(final_text)
        print(f"[lifestyle_booker] Agent result ({step_count} steps): {final_str[:200]}")

        nav_steps = extract_navigation_steps(result)

        # Learn from this attempt
        try:
            if domain:
                result_status = "unknown"
                if "RESERVATION_CONFIRMED" in final_str:
                    result_status = "booked"
                elif "PAYMENT_REQUIRED" in final_str:
                    result_status = "payment_required"
                elif "NO_AVAILABILITY" in final_str:
                    result_status = "no_availability"
                elif "BLOCKED" in final_str:
                    result_status = "blocked"
                elif "LOGIN_REQUIRED" in final_str:
                    result_status = "login_required"
                else:
                    result_status = "error"
                await learn_from_attempt(
                    domain=domain,
                    studio_name=booking_data.get("venueName", ""),
                    result_status=result_status,
                    agent_final_output=final_str,
                    step_history=step_log,
                    start_url=venue_website,
                    inline_observations=inline_observations,
                )
        except Exception as learn_err:
            print(f"[lifestyle_booker] learn_from_attempt failed (non-fatal): {learn_err}")

        # Mark session as active if the agent navigated the site while logged in
        logged_in_statuses = ("RESERVATION_CONFIRMED", "PAYMENT_REQUIRED", "NO_AVAILABILITY")
        if user_id and domain and any(kw in final_str for kw in logged_in_statuses):
            try:
                mark_studio_session(user_id, domain, "active")
                print(f"[lifestyle_booker] Marked {domain} session as active for {user_id}")
            except Exception:
                pass

        if "RESERVATION_CONFIRMED" in final_str:
            await store.set_result(job_id, {
                "status": "booked",
                "message": final_str,
                "venueWebsite": venue_website,
                "navigationSteps": nav_steps,
            })
        elif "PAYMENT_REQUIRED" in final_str:
            await store.set_result(job_id, {
                "status": "payment_required",
                "message": final_str,
                "venueWebsite": venue_website,
                "navigationSteps": nav_steps,
            })
        elif "NO_AVAILABILITY" in final_str:
            await store.set_result(job_id, {
                "status": "no_availability",
                "message": final_str,
                "venueWebsite": venue_website,
                "navigationSteps": nav_steps,
            })
        elif "BLOCKED" in final_str:
            await store.set_error(job_id, f"The website blocked automation. Please book manually: {venue_website}")
        elif "LOGIN_REQUIRED" in final_str:
            login_url = ""
            auth_options = ""
            for line in final_str.split("\n"):
                if "LOGIN_URL:" in line:
                    login_url = line.split("LOGIN_URL:", 1)[1].strip()
                elif "AUTH_OPTIONS:" in line:
                    auth_options = line.split("AUTH_OPTIONS:", 1)[1].strip()
            if user_id and domain:
                invalidate_studio_session(user_id, domain)
                print(f"[lifestyle_booker] Session expired for {domain} -- user needs to re-sign in")
            await store.set_result(job_id, {
                "status": "login_required",
                "message": f"Sign in required at {domain or 'this venue'}. Please sign in via a real browser and retry.",
                "loginUrl": login_url or venue_website,
                "authOptions": auth_options,
                "domain": domain,
                "venueWebsite": venue_website,
                "navigationSteps": nav_steps,
            })
        else:
            await store.set_result(job_id, {
                "status": "unknown",
                "message": final_str,
                "venueWebsite": venue_website,
                "navigationSteps": nav_steps,
            })

    except asyncio.TimeoutError:
        await store.set_error(job_id, f"Booking timed out after {BOOKING_TIMEOUT}s. The website may be slow. Try booking manually: {booking_data.get('venueWebsite', '')}")
        try:
            if domain:
                await learn_from_attempt(
                    domain=domain,
                    studio_name=booking_data.get("venueName", ""),
                    result_status="error",
                    agent_final_output=f"Timed out after {step_count} steps.",
                    step_history=step_log,
                    start_url=booking_data.get("venueWebsite", ""),
                    inline_observations=inline_observations,
                )
        except Exception:
            pass
    except Exception as e:
        print(f"[lifestyle_booker] Exception: {e}")
        await store.set_error(job_id, f"Booking failed: {str(e)}")
        try:
            if domain:
                await learn_from_attempt(
                    domain=domain,
                    studio_name=booking_data.get("venueName", ""),
                    result_status="error",
                    agent_final_output=f"Error: {e}",
                    step_history=step_log,
                    start_url=booking_data.get("venueWebsite", ""),
                    inline_observations=inline_observations,
                )
        except Exception:
            pass
    finally:
        try:
            if session:
                await session.close()
        except Exception:
            pass
        await asyncio.sleep(2)
        if profile_dir_path:
            kill_stale_browsers(profile_dir_path)
