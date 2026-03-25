"""
Universal booking flow test — runs the browser agent against any studio website
with debug screenshots at every step.

Usage:
  # Sign in to a studio (opens REAL Chrome — no automation, Google can't block it)
  python test_booking.py --signin --user myuser --studio "SoulCycle" --url "https://www.soul-cycle.com/checkout/"
  python test_booking.py --signin --user myuser --studio "CorePower Yoga" --url "https://www.corepoweryoga.com/profile"

  # Sign in to Google (for studios that support Google SSO)
  python test_booking.py --signin --user myuser --url "https://accounts.google.com"

  # Check session status
  python test_booking.py --check-session --user myuser

  # Book a class (agent uses saved cookies — user is already logged in)
  python test_booking.py --user myuser --studio "SoulCycle" --website "https://www.soul-cycle.com/" --date 2026-03-26
  python test_booking.py --user myuser --studio "CorePower Yoga" --website "https://www.corepoweryoga.com/" --class-type yoga
  python test_booking.py --headless false  # visible browser for debugging
  python test_booking.py --timeout 120     # custom browser startup timeout

Screenshots saved to: ./debug/test_<timestamp>/
"""

import asyncio
import argparse
import json
import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from browser_utils import (
    kill_stale_browsers, clear_profile_lock, preflight_check,
    set_browser_launch_timeout,
)
from fitness_booker import run_fitness_booking
from lifestyle_booker import run_lifestyle_booking
from site_memory import load_profile, extract_domain, get_profile_detail
from auth_session import (
    load_user_session, save_user_session, check_session_health,
    UserAuthSession, do_manual_signin, get_profile_path,
)
from job_store import store


def run_preflight(profile_dir: str | None = None) -> bool:
    """Run pre-flight checks and report results. Returns True if all critical checks pass."""
    print("\n--- Pre-flight checks ---")
    issues = preflight_check(profile_dir)

    if not issues:
        print("  All checks passed")
        return True

    has_critical = False
    for issue in issues:
        if "will be auto-cleaned" in issue:
            print(f"  [WARN] {issue}")
        else:
            print(f"  [FAIL] {issue}")
            has_critical = True

    if has_critical:
        print("\n  Critical issues found. Fix them before running the test.")
        return False

    # Auto-clean stale locks
    if profile_dir:
        clear_profile_lock(profile_dir)
        print("  Stale locks cleaned.")

    return True


def cmd_signin(args):
    """Open a real Chrome window for manual sign-in. No automation — Google can't block it."""
    user_id = args.user
    url = args.url
    studio_name = args.studio or "Unknown Studio"
    email = args.email

    # Kill any stale Chrome processes holding the profile
    from browser_profiles import get_profile_dir
    profile_dir = str(get_profile_dir(user_id))
    kill_stale_browsers(profile_dir)

    # If signing into Google directly
    if "accounts.google.com" in url or "google.com/signin" in url:
        studio_name = "Google"

    # Save email to session if provided
    if email:
        existing = load_user_session(user_id)
        session = existing or UserAuthSession(user_id=user_id, google_email=email)
        session.google_email = email
        save_user_session(session)

    domain = extract_domain(url)
    result = do_manual_signin(user_id, studio_name, url, domain)

    if result.get("success"):
        print(f"\n[SUCCESS] {result['message']}")
        print(f"\nNow run a booking:")
        if args.studio and args.studio != "Google":
            website = url.split("//")[0] + "//" + url.split("//")[1].split("/")[0] + "/"
            print(f"  python test_booking.py --user {user_id} --studio \"{args.studio}\" --website \"{website}\"")
    else:
        print(f"\n[FAILED] {result['message']}")


def cmd_setup_google(args):
    """Save Google credentials and open real Chrome for Google sign-in."""
    user_id = args.user
    email = args.email or "user@gmail.com"
    password = args.password or ""

    print(f"\n{'='*60}")
    print(f"GOOGLE SESSION SETUP")
    print(f"{'='*60}")
    print(f"User ID:  {user_id}")
    print(f"Email:    {email}")
    print(f"Password: {'set' if password else 'not set'}")
    print(f"Profile:  profiles/{user_id}/")
    print(f"{'='*60}")

    # Save the auth session with credentials
    existing = load_user_session(user_id)
    session = existing or UserAuthSession(user_id=user_id, google_email=email)
    session.google_email = email
    if password:
        session.google_password = password
    save_user_session(session)

    print(f"\n[SUCCESS] Credentials saved to: profiles/{user_id}/girlbot_session.json")

    if not args.skip_browser:
        # Open real Chrome for Google sign-in (no automation flags)
        google_url = f"https://accounts.google.com/signin/v2/identifier?flowEntry=ServiceLogin&continue=https://myaccount.google.com&Email={email}"

        # Kill stale browsers first
        from browser_profiles import get_profile_dir
        profile_dir = str(get_profile_dir(user_id))
        kill_stale_browsers(profile_dir)

        result = do_manual_signin(user_id, "Google", google_url, "google.com")
        if result.get("success"):
            # Update session
            session.google_session_seeded = True
            session.last_session_seed = time.time()
            save_user_session(session)
            print(f"\n[SUCCESS] Google session saved!")
            print(f"\nNow sign in to specific studios:")
            print(f"  python test_booking.py --signin --user {user_id} --studio \"SoulCycle\" --url \"https://www.soul-cycle.com/checkout/\"")
        else:
            print(f"\n[INFO] {result.get('message', 'Sign-in not completed')}")
    else:
        print(f"Skipped browser sign-in (--skip-browser).")


def cmd_link_resy(args):
    """Link a Resy account via email/password — no browser needed."""
    import asyncio as _asyncio
    user_id = args.user
    email = args.email
    password = args.password

    if not email:
        email = input("Resy email: ").strip()
    if not password:
        import getpass
        password = getpass.getpass("Resy password: ")

    print(f"\n{'='*60}")
    print(f"LINK RESY ACCOUNT")
    print(f"{'='*60}")
    print(f"User ID:  {user_id}")
    print(f"Email:    {email}")
    print(f"{'='*60}")

    async def _link():
        from api_clients.resy_client import ResyClient, get_resy_token_path
        import httpx

        client = ResyClient()
        try:
            user_data = await client.login(email, password)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                print(f"\n[FAILED] Invalid email or password for Resy.")
                return
            raise
        finally:
            await client.close()

        token_path = get_resy_token_path(user_id)
        client2 = ResyClient(tokens=client.tokens)
        client2.save_tokens(token_path)
        await client2.close()

        first_name = user_data.get("first_name", "")
        last_name = user_data.get("last_name", "")
        pm_id = client.tokens.payment_method_id

        print(f"\n[SUCCESS] Resy account linked!")
        print(f"  Name:    {first_name} {last_name}")
        print(f"  Email:   {email}")
        print(f"  User ID: {client.tokens.user_id}")
        print(f"  Payment: {'card on file' if pm_id else 'none (some bookings may fail)'}")
        print(f"  Tokens:  saved to {token_path}")
        print(f"\nNow book a restaurant:")
        print(f"  python test_booking.py --type lifestyle --user {user_id} --studio \"Carbone\" --website \"https://resy.com\" --party-size 2 --date 2026-03-28")

    _asyncio.run(_link())


def cmd_check_session(args):
    """Check the auth session status for a user."""
    user_id = args.user

    print(f"\n{'='*60}")
    print(f"SESSION STATUS — {user_id}")
    print(f"{'='*60}")

    session = load_user_session(user_id)
    if not session:
        print(f"No session found for user '{user_id}'.")
        print(f"Run: python test_booking.py --signin --user {user_id} --url \"https://www.soul-cycle.com/checkout/\" --studio \"SoulCycle\"")
        return

    print(f"Google email:   {session.google_email}")
    print(f"Google name:    {session.google_name or '(not set)'}")
    print(f"Session seeded: {session.google_session_seeded}")

    if session.last_session_seed:
        age_hours = (time.time() - session.last_session_seed) / 3600
        age_str = f"{age_hours:.1f} hours ago"
        if age_hours > 24:
            age_str = f"{age_hours / 24:.1f} days ago"
        fresh = age_hours < 168
        print(f"Last seeded:    {age_str} {'(fresh)' if fresh else '(EXPIRED — re-sign in)'}")
    else:
        print(f"Last seeded:    never")

    if session.studio_sessions:
        print(f"\nStudio-specific sessions:")
        for domain, status in session.studio_sessions.items():
            print(f"  {domain}: {status}")
    else:
        print(f"\nNo studio-specific sessions.")

    # Check overall health
    health = check_session_health(user_id)
    print(f"\nOverall health: {health}")

    # Check profile directory
    profile_path = get_profile_path(user_id)
    default_dir = profile_path / "Default"
    has_cookies = (default_dir / "Cookies").exists() if default_dir.exists() else False
    print(f"Profile path:   {profile_path}")
    print(f"Has cookies:    {has_cookies}")
    print(f"{'='*60}\n")


async def run_lifestyle_test(args):
    """Run a lifestyle booking test (restaurant, salon, spa, nails)."""
    job_id = f"test_lifestyle_{int(time.time())}"

    booking_data = {
        "bookingType": args.booking_type or "restaurant",
        "venueName": args.studio,
        "venueWebsite": args.website,
        "bookingUrl": args.website,
        "date": args.date,
        "time": args.class_time or "7:00 PM",
        "partySize": args.party_size or 2,
        "serviceType": args.class_type or "",
    }

    user_id = args.user
    profile_dir = None
    if user_id:
        from browser_profiles import get_profile_dir
        profile_dir = str(get_profile_dir(user_id))

    auth_session_obj = load_user_session(user_id) if user_id else None
    google_email = auth_session_obj.google_email if auth_session_obj else (args.email or "test@example.com")
    auth_status = check_session_health(user_id) if user_id else "never_logged_in"

    user_info = {
        "firstName": args.first_name or "Test",
        "lastName": args.last_name or "User",
        "email": args.email or google_email,
        "googleEmail": google_email,
        "userId": user_id,
        "hasGoogleSession": auth_status in ("google_active", "studio_active"),
    }

    if args.headless is not None:
        os.environ["BROWSER_HEADLESS"] = str(args.headless).lower()
    os.environ["BROWSER_STARTUP_TIMEOUT"] = str(args.timeout)
    set_browser_launch_timeout(args.timeout)

    if not run_preflight(profile_dir):
        sys.exit(1)

    if profile_dir:
        kill_stale_browsers(profile_dir)
    else:
        kill_stale_browsers()

    domain = extract_domain(args.website)

    print(f"\n{'='*60}")
    print(f"Lifestyle Booking Test")
    print(f"{'='*60}")
    print(f"Job ID:       {job_id}")
    print(f"Type:         {booking_data['bookingType']}")
    print(f"Venue:        {booking_data['venueName']}")
    print(f"Website:      {booking_data['venueWebsite']}")
    print(f"Domain:       {domain}")
    print(f"Date:         {booking_data['date']}")
    print(f"Time:         {booking_data['time']}")
    print(f"Party size:   {booking_data.get('partySize', '-')}")
    print(f"Service:      {booking_data.get('serviceType', '-')}")
    print(f"User:         {user_info['firstName']} {user_info['lastName']} ({user_info['email']})")
    print(f"Auth status:  {auth_status}")
    print(f"Debug dir:    ./debug/{job_id}/")
    print(f"{'='*60}\n")

    if auth_status == "never_logged_in":
        print(f"[WARN] No session found. The agent may not be logged in.")
        print(f"[WARN] Run: python test_booking.py --signin --user {user_id} --url \"{args.website}\" --studio \"{args.studio}\"\n")

    await store.create(job_id, booking_data, user_info, job_type="lifestyle")
    await run_lifestyle_booking(job_id, booking_data, user_info)

    job = await store.get(job_id)
    if not job:
        print("\n[ERROR] Job not found in store")
        return

    print(f"\n{'='*60}")
    print(f"RESULT")
    print(f"{'='*60}")
    print(f"Status:  {job['status']}")

    if job['result']:
        result_status = job['result'].get('status', 'unknown')
        print(f"Outcome: {result_status}")
        message = job['result'].get('message', '')
        print(f"Message: {message[:300]}")

        if result_status == "login_required":
            login_url = job['result'].get('loginUrl', '') or args.website
            print(f"\n--- LOGIN REQUIRED ---")
            print(f"Login URL: {login_url}")
            try:
                answer = input(f"\nOpen Chrome to sign in now? (y/n): ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                answer = "n"
            if answer in ("y", "yes"):
                from auth_session import do_manual_signin
                do_manual_signin(user_id, args.studio, login_url, extract_domain(login_url))

    if job['error']:
        print(f"Error:   {job['error']}")

    debug_dir = Path(f"./debug/{job_id}")
    if debug_dir.exists():
        screenshots = sorted(debug_dir.glob("*.png"))
        print(f"\nScreenshots ({len(screenshots)}):")
        for ss in screenshots:
            print(f"  {ss.name}")

    print(f"{'='*60}\n")


async def run_test(args):
    job_id = f"test_{int(time.time())}"

    class_data = {
        "className": args.class_type or "Any",
        "studioName": args.studio,
        "studioWebsite": args.website,
        "date": args.date,
        "time": args.class_time or "See schedule",
        "instructor": args.instructor or "See schedule",
    }

    # Determine profile directory for pre-flight
    user_id = args.user
    profile_dir = None
    if user_id:
        from browser_profiles import get_profile_dir
        profile_dir = str(get_profile_dir(user_id))

    # Load auth session
    auth_session = load_user_session(user_id) if user_id else None
    google_email = auth_session.google_email if auth_session else (args.email or "test@example.com")
    auth_status = check_session_health(user_id) if user_id else "never_logged_in"

    user_info = {
        "firstName": args.first_name or "Test",
        "lastName": args.last_name or "User",
        "email": args.email or google_email,
        "googleEmail": google_email,
        "useGoogleLogin": True,
        "userId": user_id,
        "hasGoogleSession": auth_status in ("google_active", "studio_active"),
    }

    # Override headless setting
    if args.headless is not None:
        os.environ["BROWSER_HEADLESS"] = str(args.headless).lower()

    # Set browser startup timeout
    os.environ["BROWSER_STARTUP_TIMEOUT"] = str(args.timeout)
    set_browser_launch_timeout(args.timeout)

    # Pre-flight checks
    if not run_preflight(profile_dir):
        sys.exit(1)

    # Kill stale browsers that might hold the profile
    if profile_dir:
        kill_stale_browsers(profile_dir)
    else:
        kill_stale_browsers()

    # Check for existing site profile
    domain = extract_domain(args.website)
    site_profile = load_profile(domain)

    print(f"\n{'='*60}")
    print(f"Universal Booking Test")
    print(f"{'='*60}")
    print(f"Job ID:      {job_id}")
    print(f"Studio:      {class_data['studioName']}")
    print(f"Website:     {class_data['studioWebsite']}")
    print(f"Domain:      {domain}")
    print(f"Class:       {class_data['className']}")
    print(f"Date:        {class_data['date']}")
    print(f"Time:        {class_data['time']}")
    print(f"User:        {user_info['firstName']} {user_info['lastName']} ({user_info['email']})")
    print(f"Google:      {google_email}")
    print(f"Auth status: {auth_status}")
    print(f"Has session: {'YES' if user_info['hasGoogleSession'] else 'NO'}")
    print(f"Site memory: {'loaded (confidence: ' + f'{site_profile.confidence:.2f})' if site_profile else 'none — cold start'}")
    print(f"Timeout:     {args.timeout}s (browser startup), {os.getenv('FITNESS_BOOKING_TIMEOUT', '300')}s (booking)")
    print(f"Debug dir:   ./debug/{job_id}/")
    print(f"{'='*60}\n")

    if auth_status == "never_logged_in":
        print("[WARN] No session found. The agent may not be logged in.")
        print(f"[WARN] Run: python test_booking.py --signin --user {user_id} --studio \"{args.studio}\" --url \"{args.website}\"\n")

    await store.create(job_id, class_data, user_info, job_type="fitness")

    # Run the booking
    await run_fitness_booking(job_id, class_data, user_info)

    # Get final result
    job = await store.get(job_id)
    if not job:
        print("\n[ERROR] Job not found in store")
        return

    print(f"\n{'='*60}")
    print(f"RESULT")
    print(f"{'='*60}")
    print(f"Status:  {job['status']}")

    if job['result']:
        result_status = job['result'].get('status', 'unknown')
        print(f"Outcome: {result_status}")
        message = job['result'].get('message', '')
        print(f"Message: {message[:300]}")

        # Handle LOGIN_REQUIRED — offer to sign in and retry
        if result_status == "login_required":
            login_url = job['result'].get('loginUrl', '') or args.website
            print(f"\n--- LOGIN REQUIRED ---")
            print(f"The agent couldn't find an active session at {extract_domain(args.website)}.")
            print(f"Login URL: {login_url}")

            # Ask user if they want to sign in now
            try:
                answer = input(f"\nOpen Chrome to sign in now? (y/n): ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                answer = "n"

            if answer in ("y", "yes"):
                from auth_session import do_manual_signin
                signin_result = do_manual_signin(user_id, args.studio, login_url, extract_domain(login_url))
                if signin_result.get("success"):
                    try:
                        retry = input(f"\nRetry booking now? (y/n): ").strip().lower()
                    except (EOFError, KeyboardInterrupt):
                        retry = "n"
                    if retry in ("y", "yes"):
                        print(f"\n--- RETRYING BOOKING ---\n")
                        await run_test(args)
                        return
            else:
                print(f"\nTo sign in later and retry:")
                print(f"  python test_booking.py --signin --user {user_id} --url \"{login_url}\" --studio \"{args.studio}\"")
                print(f"  python test_booking.py --user {user_id} --studio \"{args.studio}\" --website \"{args.website}\"")

        nav_steps = job['result'].get('navigationSteps', [])
        if nav_steps:
            print(f"\nNavigation steps ({len(nav_steps)}):")
            for s in nav_steps:
                print(f"  {s.get('step', '?')}. {s.get('goal', '')[:80]}")
                if s.get('url'):
                    print(f"     URL: {s['url']}")

    if job['error']:
        print(f"Error:   {job['error']}")

    # List debug screenshots
    debug_dir = Path(f"./debug/{job_id}")
    if debug_dir.exists():
        screenshots = sorted(debug_dir.glob("*.png"))
        print(f"\nScreenshots ({len(screenshots)}):")
        for ss in screenshots:
            print(f"  {ss.name}")

    # Show updated site profile
    updated_profile = get_profile_detail(domain)
    if updated_profile:
        print(f"\n{'='*60}")
        print(f"SITE PROFILE — {domain}")
        print(f"{'='*60}")
        print(json.dumps(updated_profile, indent=2))

    print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(description="Universal fitness class booking test")

    # Auth commands
    auth_group = parser.add_argument_group("authentication commands")
    auth_group.add_argument("--signin", action="store_true",
        help="Open real Chrome for manual sign-in (Google can't block this)")
    auth_group.add_argument("--setup-google", action="store_true",
        help="Save Google credentials and open Chrome for Google sign-in")
    auth_group.add_argument("--check-session", action="store_true",
        help="Check auth session status")
    auth_group.add_argument("--link-resy", action="store_true",
        help="Link Resy account (email + password, no browser needed)")
    auth_group.add_argument("--url", default=None,
        help="URL to open for --signin (e.g., studio login page)")
    auth_group.add_argument("--password", default=None,
        help="Password (for --link-resy or --setup-google)")
    auth_group.add_argument("--skip-browser", action="store_true",
        help="Skip browser sign-in during --setup-google")

    # Booking params
    booking_group = parser.add_argument_group("booking parameters")
    booking_group.add_argument("--type", default="fitness",
        choices=["fitness", "lifestyle"],
        help="Booking type: fitness (default) or lifestyle (restaurant/salon/spa)")
    booking_group.add_argument("--booking-type", default="restaurant",
        help="Lifestyle booking subtype: restaurant, salon, spa, nails (default: restaurant)")
    booking_group.add_argument("--studio", default=None,
        help="Studio/venue name (e.g., 'SoulCycle Miami Beach', 'Nobu Miami')")
    booking_group.add_argument("--website", default=None,
        help="Studio/venue website URL")
    booking_group.add_argument("--class-type", default=None,
        help="Class type (fitness) or service type (lifestyle)")
    booking_group.add_argument("--class-time", default=None,
        help="Preferred time (e.g., 5:30PM, 7:00PM)")
    booking_group.add_argument("--instructor", default=None,
        help="Preferred instructor name")
    booking_group.add_argument("--date", default=None,
        help="Date (e.g., 2026-03-26)")
    booking_group.add_argument("--party-size", type=int, default=2,
        help="Party size for restaurant bookings (default: 2)")

    # User / browser params
    parser.add_argument("--user", default="test-user-123",
        help="User ID for browser profile (default: test-user-123)")
    parser.add_argument("--email", default=None, help="User email")
    parser.add_argument("--first-name", default=None, help="User first name")
    parser.add_argument("--last-name", default=None, help="User last name")
    parser.add_argument("--headless", default=None, help="Run headless (true/false)")
    parser.add_argument("--timeout", type=int, default=90,
        help="Browser startup timeout in seconds (default: 90)")

    args = parser.parse_args()

    # Dispatch to the right command
    if args.signin:
        if not args.url:
            parser.error("--signin requires --url (the studio's login or account page)")
        cmd_signin(args)
        return

    if args.setup_google:
        cmd_setup_google(args)
        return

    if args.link_resy:
        cmd_link_resy(args)
        return

    if args.check_session:
        cmd_check_session(args)
        return

    # Booking mode — require studio and website
    if not args.studio or not args.website:
        parser.error("Booking mode requires --studio and --website (or use --signin / --setup-google / --check-session)")

    if not args.date:
        from datetime import datetime, timedelta
        tomorrow = datetime.now() + timedelta(days=1)
        args.date = tomorrow.strftime("%Y-%m-%d")
        print(f"No date specified, using tomorrow: {args.date}")

    if args.type == "lifestyle":
        asyncio.run(run_lifestyle_test(args))
    else:
        asyncio.run(run_test(args))


if __name__ == "__main__":
    main()
