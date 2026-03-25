"""Shared browser infrastructure for all booking agents (fitness, lifestyle, etc.)."""

import asyncio
import os
import json
import subprocess
import urllib.request
from browser_use.browser.profile import BrowserProfile
from browser_use.browser.session import BrowserSession
from browser_profiles import get_profile_dir, has_profile
from browser_utils import (
    kill_stale_browsers, clear_profile_lock, find_available_debug_port,
)

BROWSER_HEADLESS = os.getenv("BROWSER_HEADLESS", "true").lower() == "true"


async def launch_chrome_with_cdp(profile_dir: str, debug_port: int, headless: bool = False) -> str:
    """Launch system Chrome directly (not through Playwright) with remote debugging.
    Returns the CDP WebSocket URL for connecting browser-use to this instance.
    This avoids Google's automation detection that blocks Playwright-launched browsers.
    """
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

    print(f"[booking_browser] Launching system Chrome on port {debug_port} with profile {abs_profile}...")
    proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
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
                print(f"[booking_browser] Chrome ready: {ws_url}")
                return ws_url
        except Exception:
            if attempt % 5 == 4:
                print(f"[booking_browser] Waiting for Chrome... (attempt {attempt + 1})")

    raise RuntimeError(f"Chrome didn't start on port {debug_port} within 30s")


async def create_browser_session(user_info: dict) -> tuple[BrowserSession, str | None]:
    """Create a browser session with cleanup of stale processes/locks.

    For users with a profile: launches system Chrome directly and connects via CDP.
    This avoids Google's "browser not secure" rejection that blocks Playwright-launched Chrome.

    Returns (session, profile_dir_path) -- profile_dir_path is None for ephemeral sessions.
    """
    user_id = user_info.get("userId")
    profile_dir_path = None

    if user_id and has_profile(user_id):
        profile_dir_path = str(get_profile_dir(user_id))
        print(f"[booking_browser] Using persistent browser profile for user {user_id}")

        clear_profile_lock(profile_dir_path)
        kill_stale_browsers(profile_dir_path)

        debug_port = find_available_debug_port()
        ws_url = await launch_chrome_with_cdp(profile_dir_path, debug_port, headless=BROWSER_HEADLESS)

        profile = BrowserProfile(cdp_url=ws_url)
        session = BrowserSession(browser_profile=profile)
        return session, profile_dir_path
    else:
        print(f"[booking_browser] No persistent profile -- using ephemeral browser")
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
