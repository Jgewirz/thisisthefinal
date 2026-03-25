import asyncio
import os
import time
from pathlib import Path
from browser_use.agent.service import Agent
from browser_use.browser.profile import BrowserProfile
from browser_use.browser.session import BrowserSession
from browser_use.llm.openai.chat import ChatOpenAI
from job_store import store
from browser_profiles import get_browser_profile, has_profile, get_profile_dir
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

# Set browser startup timeout BEFORE browser-use reads it
BROWSER_STARTUP_TIMEOUT = int(os.getenv("BROWSER_STARTUP_TIMEOUT", "90"))
set_browser_launch_timeout(BROWSER_STARTUP_TIMEOUT)

BROWSER_HEADLESS = os.getenv("BROWSER_HEADLESS", "true").lower() == "true"
BOOKING_TIMEOUT = int(os.getenv("FITNESS_BOOKING_TIMEOUT", "300"))
BROWSER_MAX_LAUNCH_RETRIES = int(os.getenv("BROWSER_MAX_LAUNCH_RETRIES", "2"))
DEBUG_DIR = Path(os.getenv("BOOKING_DEBUG_DIR", "./debug"))
DEBUG_DIR.mkdir(parents=True, exist_ok=True)


def extract_navigation_steps(result) -> list[dict]:
    """Extract a condensed navigation recipe from the agent's run history."""
    steps = []
    try:
        actions = result.action_names()
        thoughts = result.model_thoughts()
        urls = result.urls()

        for i, thought in enumerate(thoughts):
            step = {
                "step": i + 1,
                "goal": thought.next_goal or "",
                "action": actions[i] if i < len(actions) else "",
                "url": urls[i] if i < len(urls) else None,
                "memory": thought.memory or "",
            }
            steps.append(step)
    except Exception as e:
        print(f"[fitness_booker] Failed to extract navigation steps: {e}")
    return steps


def build_booking_prompt(class_data: dict, user_info: dict, known_steps: list | None = None, site_profile=None, auth_status: str = "never_logged_in") -> str:
    """Build a universal booking prompt with 4 layers."""
    studio_website = class_data.get("studioWebsite", "") or class_data.get("bookingUrl", "")
    class_name = class_data.get("className", "")
    instructor = class_data.get("instructor", "")
    class_date = class_data.get("date", "")
    class_time = class_data.get("time", "")
    studio_name = class_data.get("studioName", "")
    user_city = class_data.get("userCity", "")
    user_region = class_data.get("userRegion", "")

    first_name = user_info.get("firstName", "")
    last_name = user_info.get("lastName", "")
    email = user_info.get("email", "")
    phone = user_info.get("phone", "")
    google_email = user_info.get("googleEmail", email)

    has_google_session = auth_status in ("google_active", "studio_active") or user_info.get("hasGoogleSession", False)

    # ── LAYER 1: Identity + Target ──────────────────────────────────

    # Handle "See schedule" placeholders
    time_instruction = ""
    if class_time and class_time.lower() in ("see schedule", "tbd", ""):
        time_instruction = f"""
NOTE: No specific class time was provided. Browse the schedule and look for any
"{class_name}" class available on {class_date}. Pick the first available one.
If the user mentioned a preferred time in conversation, match that.
"""
    else:
        time_instruction = f"- Target time: {class_time}"

    instructor_note = ""
    if instructor and instructor.lower() not in ("see schedule", "tbd", ""):
        instructor_note = f"- Preferred instructor: {instructor}"

    user_city_display = user_city or ""
    if user_region:
        user_city_display = f"{user_city}, {user_region}" if user_city else user_region

    location_note = ""
    if user_city_display:
        location_note = f"- User's city/region: {user_city_display}"

    # Authentication instructions — check existing session, report LOGIN_REQUIRED if not logged in
    # The user signs in via real Chrome (--signin CLI). The agent just checks if cookies work.

    # Universal auth block — works for any fitness studio website.
    # The user signs in once via real Chrome (--signin). The agent checks cookies.
    if has_google_session:
        auth_block = f"""
AUTHENTICATION — YOU ARE ALREADY LOGGED IN (most likely):
The user has previously signed into this studio website. Their session cookies
are saved in this browser. You should be able to book without any login.

  STEP 1 — VERIFY LOGGED-IN STATE (do this BEFORE anything else):
     Look for ANY of these indicators that the user is signed in:
     - A user name, initials, avatar, or profile photo in the header/nav bar
     - Links like "My Account", "Profile", "My Classes", "My Schedule", "My Bookings"
     - A greeting like "Welcome", "Hi [Name]", or "Hello [Name]"
     - The ABSENCE of "Sign In", "Log In", or "Create Account" buttons
     - A credits/package balance displayed (e.g., "3 credits remaining")
     - An account dropdown or hamburger menu showing user-specific options

     Common patterns across fitness sites:
     - SoulCycle/Equinox: user avatar top-right, "MY SOUL" or "MY ACCOUNT" link
     - CorePower Yoga: "My Account" in nav, or profile icon
     - Barry's: user name in header, "My Bookings" link
     - ClassPass: profile icon, "Upcoming" tab showing user's classes
     - Mindbody-powered sites: "My Info" or "My Schedule" in nav
     - Peloton/SLT/Solidcore: account icon or initials badge

     If you see ANY of these signs → you ARE logged in → proceed to PHASE 3 (schedule).
     Do NOT click "Sign In" or navigate to a login page if you're already logged in.

  STEP 2 — IF NOT LOGGED IN (the site shows a login wall or redirects to sign-in):
     - DO NOT type any credentials, passwords, or emails
     - DO NOT click "Continue with Google" or any SSO buttons
     - DO NOT try to create a new account
     - Report LOGIN_REQUIRED immediately with:
       LOGIN_URL: <the exact URL of the login page you see>
       AUTH_OPTIONS: <list what login methods the site offers: Google, email/password, Facebook, etc.>
     The user will sign in manually and retry. This is normal for first-time studios.

IMPORTANT: If you get redirected to a login page while browsing the schedule or
during booking, that means the session expired. Report LOGIN_REQUIRED immediately.
Do not attempt to re-authenticate — the user will handle it.
"""
    else:
        auth_block = f"""
AUTHENTICATION — CHECK IF LOGGED IN:
  1. Look for signs you're already logged in:
     - User name/avatar/initials in the header or nav bar
     - "My Account", "Profile", "My Classes" links
     - Absence of "Sign In" / "Log In" buttons
     - Credits/package balance displayed
     If logged in → proceed directly to booking.

  2. If NOT logged in (login page, "Sign In" button visible):
     - DO NOT type credentials, click Google SSO, or create accounts
     - Report LOGIN_REQUIRED immediately with:
       LOGIN_URL: <the login page URL>
       AUTH_OPTIONS: <what login methods the site offers>
     The user will sign in manually via a real browser and retry.
"""

    layer1 = f"""You are a universal booking agent. Your goal is to COMPLETE a fitness class booking on ANY studio website.
Finding classes is NOT enough -- you must go through the ENTIRE booking flow until you see a confirmation.

TARGET: Book a class at {studio_name}
- Class type: {class_name}
- Date: {class_date}
{time_instruction}
{instructor_note}
- Website: {studio_website}
{location_note}

USER INFO (for any forms):
- Name: {first_name} {last_name}
- Email: {email}
{f'- Phone: {phone}' if phone else ''}

{auth_block}"""

    # ── LAYER 2: Universal Navigation Method ────────────────────────

    layer2 = """
UNIVERSAL NAVIGATION METHOD:
Follow these 6 phases in order. Adapt to whatever the website presents.

PHASE 1 — ORIENT:
- Navigate to the studio website URL
- If you see a 404, "Page Not Found", or error page, go to the site's homepage instead
  (strip the path — just use the domain, e.g., https://www.example.com/)
- Dismiss any popups, cookie banners, promotional overlays, or newsletter signups
- Identify the site layout: look for navigation menus, "Book", "Classes", "Schedule" links
- If the site has a location/city picker, set it to the user's city/region FIRST

PHASE 2 — AUTHENTICATE (if required):
- Check if you're already logged in (user avatar, account menu, "Welcome [name]")
- If already logged in, skip auth entirely and proceed to Phase 3
- If not logged in and the site requires it, follow the AUTHENTICATION instructions above
- After Google OAuth popups/redirects, wait 5-10 seconds before interacting with the page
- If Google SSO is not available and you're not logged in, report LOGIN_REQUIRED immediately
  with the current login page URL and what auth options the site offers
- NEVER type passwords or create accounts — use Google SSO or report back

PHASE 3 — LOCATE SCHEDULE:
- Find the class schedule or booking section
- This might be: a "Schedule" page, "Classes" tab, "Book" button, calendar view, or timetable
- IMPORTANT: If you see a list of cities or studio locations instead of a class schedule,
  you MUST select a specific studio/location FIRST. The schedule will NOT appear until
  you pick a location. Do NOT scroll past the location list — click one.
- If the schedule appears empty or shows no classes, a location filter is likely required.
  Look for a search box, dropdown, or clickable city/studio name at the top of the page.
- Do NOT spend more than 2 steps scrolling. If scrolling hasn't revealed a schedule,
  go back to the top and look for navigation links or location selectors instead.
- Wait for dynamic content to load (SPAs may take 3-5 seconds)

PHASE 4 — FIND CLASS:
- Navigate to the correct date using date tabs, calendar, arrows, or date picker
- Scan the schedule for the target class (match class type, time, and/or instructor)
- If the exact class isn't found, look for the closest match
- If the class shows "Waitlist" or "Full", report CLASS_FULL

PHASE 5 — BOOK:
- Click the booking button (may be labeled "Reserve", "Book", "Register", "Sign Up", "Enroll", etc.)
- Complete any intermediate steps:
  * Spot/bike/mat selection: pick any available position
  * Form fields: fill in name, email, phone from user info
  * Waivers/agreements: check required boxes and accept
  * Package/credit selection: use existing credits if available
- If a payment form with credit card fields appears, STOP and report PAYMENT_REQUIRED
- If redirected to a purchase page (buy credits, buy package, pricing page), report PAYMENT_REQUIRED
- Using existing credits/class packs IS OK — that's not a purchase

PHASE 6 — HANDLE OBSTACLES:
- If stuck on the same page for 3+ steps, try refreshing once
- If a page appears blank, wait 3-5 seconds then scroll to trigger lazy loading
- If stuck repeating the same action 3+ times, try a different approach
- Maximum 3 wait-and-retry cycles on any single page before trying a different route
- If the site has an unsolvable CAPTCHA, report BLOCKED"""

    # ── LAYER 3: Site-Specific Hints ────────────────────────────────

    layer3_parts = []

    # Inject site memory if available
    if site_profile:
        profile_text = format_profile_for_prompt(site_profile)
        if profile_text:
            layer3_parts.append(profile_text)

    # Inject known navigation steps from Express
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

    # ── LAYER 4: Reporting Format ───────────────────────────────────

    layer4 = """
SUCCESS CRITERIA — you must reach a BOOKING CONFIRMATION to report CLASS_BOOKED.
Just finding a class on the schedule is NOT success — you must complete the reservation.

REPORT your final status using EXACTLY one of these keywords:
- CLASS_BOOKED — successfully completed the booking (include confirmation details)
- PAYMENT_REQUIRED — booking requires purchasing credits/class pack (user has no balance)
- ALREADY_REGISTERED — user is already signed up for this class
- CLASS_FULL — class has no spots / is full / waitlist only
- BLOCKED — site blocked automation or has unsolvable CAPTCHA
- LOGIN_REQUIRED — login needed but Google SSO not available and not already logged in.
  Include: LOGIN_URL: <the login page URL>, AUTH_OPTIONS: <what login methods the site offers>
- ERROR — something else went wrong (describe what happened)

Include any confirmation number, booking reference, bike/spot number, or success message.

SITE OBSERVATIONS (fill this out at the end of your response for learning):
After reporting your status, add a section starting with "=== SITE OBSERVATIONS ===" containing:
- What type of platform/framework the site uses
- How authentication works
- How the schedule is organized
- Any obstacles you encountered
- Tips for navigating this site faster next time
- What class types you saw on the schedule"""

    return f"{layer1}\n{layer2}\n{layer3}\n{layer4}"


async def _launch_chrome_with_cdp(profile_dir: str, debug_port: int, headless: bool = False) -> str:
    """Launch system Chrome directly (not through Playwright) with remote debugging.
    Returns the CDP WebSocket URL for connecting browser-use to this instance.
    This avoids Google's automation detection that blocks Playwright-launched browsers.
    """
    import subprocess
    import json
    import urllib.request

    # Find system Chrome on Windows
    chrome_paths = [
        os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
    ]
    chrome_path = None
    for p in chrome_paths:
        if os.path.exists(p):
            chrome_path = p
            break

    if not chrome_path:
        raise RuntimeError("System Chrome not found. Install Google Chrome.")

    # Use absolute path to avoid issues with cwd
    abs_profile = os.path.abspath(profile_dir)

    args = [
        chrome_path,
        f"--remote-debugging-port={debug_port}",
        f"--user-data-dir={abs_profile}",
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank",
    ]
    if headless:
        args.append("--headless=new")

    print(f"[fitness_booker] Launching system Chrome on port {debug_port} with profile {abs_profile}...")
    proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    # Give Chrome a moment to start
    await asyncio.sleep(2)
    if proc.poll() is not None:
        _, stderr = proc.communicate()
        raise RuntimeError(f"Chrome exited immediately: {stderr.decode()[:500]}")

    # Wait for Chrome to be ready and get the WebSocket URL
    version_url = f"http://127.0.0.1:{debug_port}/json/version"
    for attempt in range(30):
        await asyncio.sleep(1)
        try:
            resp = urllib.request.urlopen(version_url, timeout=2)
            data = json.loads(resp.read())
            ws_url = data.get("webSocketDebuggerUrl", "")
            if ws_url:
                print(f"[fitness_booker] Chrome ready: {ws_url}")
                return ws_url
        except Exception:
            if attempt % 5 == 4:
                print(f"[fitness_booker] Waiting for Chrome... (attempt {attempt + 1})")

    raise RuntimeError(f"Chrome didn't start on port {debug_port} within 30s")


async def _create_browser_session(user_info: dict) -> tuple[BrowserSession, str | None]:
    """Create a browser session with cleanup of stale processes/locks.

    For users with a profile: launches system Chrome directly and connects via CDP.
    This avoids Google's "browser not secure" rejection that blocks Playwright-launched Chrome.

    Returns (session, profile_dir_path) -- profile_dir_path is None for ephemeral sessions.
    """
    user_id = user_info.get("userId")
    profile_dir_path = None

    if user_id and has_profile(user_id):
        profile_dir_path = str(get_profile_dir(user_id))
        print(f"[fitness_booker] Using persistent browser profile for user {user_id}")

        # Clean up stale locks/processes from crashed sessions
        clear_profile_lock(profile_dir_path)
        kill_stale_browsers(profile_dir_path)

        # Launch system Chrome directly and connect via CDP
        debug_port = find_available_debug_port()
        ws_url = await _launch_chrome_with_cdp(profile_dir_path, debug_port, headless=BROWSER_HEADLESS)

        profile = BrowserProfile(cdp_url=ws_url)
        session = BrowserSession(browser_profile=profile)
        return session, profile_dir_path
    else:
        print(f"[fitness_booker] No persistent profile -- using ephemeral browser")
        debug_port = find_available_debug_port()
        profile = BrowserProfile(
            headless=BROWSER_HEADLESS,
            channel="chrome",
            args=[
                f"--remote-debugging-port={debug_port}",
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ],
        )

    session = BrowserSession(browser_profile=profile)
    return session, profile_dir_path


async def run_fitness_booking(job_id: str, class_data: dict, user_info: dict, known_steps: list | None = None) -> None:
    """Run the browser-use booking agent for a fitness class."""
    session = None
    job_debug_dir = DEBUG_DIR / job_id
    job_debug_dir.mkdir(parents=True, exist_ok=True)

    try:
        await store.update_status(job_id, "navigating", "Opening studio website...")

        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        # Pre-validate the studio URL -- fall back to homepage if it 404s
        studio_website = class_data.get("studioWebsite", "") or class_data.get("bookingUrl", "")
        if studio_website:
            reachable, status = await check_url_reachable(studio_website)
            if not reachable and status and status >= 400:
                homepage = get_homepage_url(studio_website)
                print(f"[fitness_booker] URL returned {status}, falling back to homepage: {homepage}")
                class_data = {**class_data, "studioWebsite": homepage}
                studio_website = homepage

        # Load site profile for this domain
        domain = extract_domain(studio_website)
        site_profile = load_profile(domain)
        if site_profile:
            print(f"[fitness_booker] Loaded site profile for {domain} (confidence: {site_profile.confidence:.2f})")
        else:
            print(f"[fitness_booker] No site profile for {domain} — navigating from scratch")

        # Load user's auth session and check health
        user_id = user_info.get("userId")
        auth_status = "never_logged_in"
        if user_id:
            auth_status = check_session_health(user_id, domain)
            auth_session = load_user_session(user_id)
            if auth_session and auth_session.google_email:
                user_info = {**user_info, "googleEmail": auth_session.google_email}
            print(f"[fitness_booker] Auth status for {user_id}: {auth_status}")

        task = build_booking_prompt(class_data, user_info, known_steps, site_profile, auth_status=auth_status)

        # Determine max steps: known sites get fewer, unknown sites get more room to explore
        max_steps = 25 if (site_profile and site_profile.confidence > 0.5) else 30

        # Step callback for progress updates, debug screenshots, and inline observation capture
        step_count = 0
        step_log: list[dict] = []           # Captured metadata per step
        inline_observations: dict = {}      # Accumulated inline observations

        async def on_step_end(agent_instance):
            nonlocal step_count
            step_count += 1

            current_url = ""
            # Save debug screenshot at every step using browser-use 0.12.x API
            try:
                screenshot_path = str(job_debug_dir / f"step_{step_count:02d}.png")
                screenshot_bytes = await session.take_screenshot(full_page=False)
                if screenshot_bytes:
                    Path(screenshot_path).write_bytes(screenshot_bytes)
                current_url = await session.get_current_page_url()
                print(f"[fitness_booker] Step {step_count}: {current_url} -> {screenshot_path}")
            except Exception as e:
                print(f"[fitness_booker] Screenshot failed at step {step_count}: {e}")

            # Capture step metadata from the agent's history for learning
            # Agent.history is AgentHistoryList; each item has model_output (AgentOutput)
            # AgentOutput has: thinking, evaluation_previous_goal, memory, next_goal, action
            step_entry = {"step": step_count, "url": current_url, "action": "", "goal": "", "memory": "", "eval": ""}
            try:
                hist_list = agent_instance.history  # AgentHistoryList
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
                pass  # Step metadata is best-effort

            step_log.append(step_entry)

            # Extract inline observations from this step (no LLM, instant)
            obs = extract_inline_observations(step_entry)
            if obs:
                merge_inline_observations(inline_observations, obs, step_count)

            # Update progress status
            if step_count <= 3:
                await store.update_status(job_id, "navigating", "Navigating studio website...")
            elif step_count <= 5:
                await store.update_status(job_id, "navigating", "Handling login...")
            elif step_count <= 10:
                await store.update_status(job_id, "finding_class", "Browsing class schedule...")
            elif step_count <= 15:
                await store.update_status(job_id, "filling_form", "Completing booking steps...")
            elif step_count <= 20:
                await store.update_status(job_id, "filling_form", "Selecting options...")
            else:
                await store.update_status(job_id, "processing", "Finalizing booking...")

        # Browser launch with retry -- handles stale locks, port conflicts, slow starts
        result = None
        last_error = None
        profile_dir_path = None

        for attempt in range(BROWSER_MAX_LAUNCH_RETRIES):
            try:
                # Close any session from a previous failed attempt
                if session:
                    try:
                        await session.close()
                    except Exception:
                        pass
                    session = None

                session, profile_dir_path = await _create_browser_session(user_info)

                # Pre-navigate to the studio URL so the agent doesn't start on about:blank
                # This saves 2-3 steps of the agent waiting for a blank page to load
                try:
                    await session.navigate_to(studio_website)
                    print(f"[fitness_booker] Pre-navigated to {studio_website}")
                    await asyncio.sleep(2)  # Let SPA render
                except Exception as nav_err:
                    print(f"[fitness_booker] Pre-navigation failed (agent will retry): {nav_err}")

                agent = Agent(
                    task=task,
                    llm=llm,
                    browser_session=session,
                )

                await store.update_status(job_id, "finding_class", "Searching for your class...")

                result = await asyncio.wait_for(
                    agent.run(max_steps=max_steps, on_step_end=on_step_end),
                    timeout=BOOKING_TIMEOUT,
                )
                break  # Success -- exit retry loop

            except (asyncio.TimeoutError, Exception) as e:
                last_error = e
                is_browser_launch_failure = (
                    "timed out" in str(e).lower()
                    and step_count == 0  # No steps taken = browser never launched
                )

                if is_browser_launch_failure and attempt < BROWSER_MAX_LAUNCH_RETRIES - 1:
                    print(f"[fitness_booker] Browser launch attempt {attempt + 1} failed: {e}")
                    print(f"[fitness_booker] Cleaning up and retrying...")

                    # Aggressive cleanup before retry
                    if profile_dir_path:
                        kill_stale_browsers(profile_dir_path)
                        clear_profile_lock(profile_dir_path)
                    else:
                        kill_stale_browsers()

                    await asyncio.sleep(2)
                    step_count = 0  # Reset for retry
                    continue
                else:
                    raise  # Not a launch failure or out of retries -- propagate

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
        print(f"[fitness_booker] Agent result ({step_count} steps): {final_str[:200]}")

        # Extract the navigation steps the agent took (for learning)
        nav_steps = extract_navigation_steps(result)

        # Learn from this attempt (non-fatal)
        try:
            if domain:
                result_status = "unknown"
                if "CLASS_BOOKED" in final_str:
                    result_status = "booked"
                elif "ALREADY_REGISTERED" in final_str:
                    result_status = "already_registered"
                elif "PAYMENT_REQUIRED" in final_str:
                    result_status = "payment_required"
                elif "CLASS_FULL" in final_str:
                    result_status = "class_full"
                elif "BLOCKED" in final_str:
                    result_status = "blocked"
                elif "LOGIN_REQUIRED" in final_str:
                    result_status = "login_required"
                else:
                    result_status = "error"
                await learn_from_attempt(
                    domain=domain,
                    studio_name=class_data.get("studioName", ""),
                    result_status=result_status,
                    agent_final_output=final_str,
                    step_history=step_log,
                    start_url=studio_website,
                    inline_observations=inline_observations,
                )
        except Exception as learn_err:
            print(f"[fitness_booker] learn_from_attempt failed (non-fatal): {learn_err}")

        # Any result that means the agent navigated the site while logged in
        # confirms the session is active — remember it for future bookings
        logged_in_statuses = ("CLASS_BOOKED", "ALREADY_REGISTERED", "PAYMENT_REQUIRED", "CLASS_FULL")
        if user_id and domain and any(kw in final_str for kw in logged_in_statuses):
            try:
                mark_studio_session(user_id, domain, "active")
                print(f"[fitness_booker] Marked {domain} session as active for {user_id}")
            except Exception:
                pass

        if "CLASS_BOOKED" in final_str:
            await store.set_result(job_id, {
                "status": "booked",
                "message": final_str,
                "studioWebsite": class_data.get("studioWebsite", ""),
                "navigationSteps": nav_steps,
            })
        elif "ALREADY_REGISTERED" in final_str:
            await store.set_result(job_id, {
                "status": "already_registered",
                "message": final_str,
                "studioWebsite": class_data.get("studioWebsite", ""),
                "navigationSteps": nav_steps,
            })
        elif "PAYMENT_REQUIRED" in final_str:
            await store.set_result(job_id, {
                "status": "payment_required",
                "message": final_str,
                "studioWebsite": class_data.get("studioWebsite", ""),
                "navigationSteps": nav_steps,
            })
        elif "CLASS_FULL" in final_str:
            await store.set_result(job_id, {
                "status": "class_full",
                "message": final_str,
                "studioWebsite": class_data.get("studioWebsite", ""),
                "navigationSteps": nav_steps,
            })
        elif "BLOCKED" in final_str:
            await store.set_error(job_id, f"The studio website blocked automation. Please book manually: {class_data.get('studioWebsite', '')}")
        elif "LOGIN_REQUIRED" in final_str:
            # Extract login URL and auth options from agent output
            login_url = ""
            auth_options = ""
            for line in final_str.split("\n"):
                if "LOGIN_URL:" in line:
                    login_url = line.split("LOGIN_URL:", 1)[1].strip()
                elif "AUTH_OPTIONS:" in line:
                    auth_options = line.split("AUTH_OPTIONS:", 1)[1].strip()
            # Invalidate any stale studio session
            if user_id and domain:
                invalidate_studio_session(user_id, domain)
                print(f"[fitness_booker] Session expired for {domain} — user needs to re-sign in")
            await store.set_result(job_id, {
                "status": "login_required",
                "message": f"Sign in required at {domain or 'this studio'}. Please sign in via a real browser and retry.",
                "loginUrl": login_url or class_data.get("studioWebsite", ""),
                "authOptions": auth_options,
                "domain": domain,
                "studioWebsite": class_data.get("studioWebsite", ""),
                "navigationSteps": nav_steps,
            })
        else:
            await store.set_result(job_id, {
                "status": "unknown",
                "message": final_str,
                "studioWebsite": class_data.get("studioWebsite", ""),
                "navigationSteps": nav_steps,
            })

    except asyncio.TimeoutError:
        await store.set_error(job_id, f"Booking timed out after {BOOKING_TIMEOUT}s. The studio website may be slow. Try booking manually: {class_data.get('studioWebsite', '')}")
        # Learn from the partial attempt — step_log and inline_observations are
        # captured per-step so they're available even when the agent times out
        try:
            if domain:
                await learn_from_attempt(
                    domain=domain,
                    studio_name=class_data.get("studioName", ""),
                    result_status="error",
                    agent_final_output=f"Timed out after {step_count} steps.",
                    step_history=step_log,
                    start_url=studio_website,
                    inline_observations=inline_observations,
                )
        except Exception:
            pass
    except Exception as e:
        print(f"[fitness_booker] Exception: {e}")
        await store.set_error(job_id, f"Booking failed: {str(e)}")
        try:
            if domain:
                await learn_from_attempt(
                    domain=domain,
                    studio_name=class_data.get("studioName", ""),
                    result_status="error",
                    agent_final_output=f"Error: {e}",
                    step_history=step_log,
                    start_url=studio_website,
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
        # Give Chrome a moment to flush cookies/session data to disk before killing
        await asyncio.sleep(2)
        # Kill only Chrome processes for THIS user's profile (not all Chrome)
        if profile_dir_path:
            kill_stale_browsers(profile_dir_path)
