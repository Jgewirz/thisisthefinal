"""
Persistent browser profile management for per-user Chrome sessions.

Each user gets a Chrome profile directory at ./profiles/{user_id}/.

Two modes:
  1. SIGN-IN mode: Opens real Chrome (no automation flags) for manual login.
     Google can't detect automation because there IS no automation.
  2. BOOKING mode: Opens Chrome with --remote-debugging-port for CDP control.
     The agent navigates using saved cookies from sign-in mode.

The sign-in happens in an unautomated browser.
The booking happens in an automated browser.
Same profile directory, different Chrome instances, different launch flags.
"""

import os
import platform
import subprocess
import time
from pathlib import Path
from browser_use.browser.profile import BrowserProfile

PROFILES_DIR = Path(os.getenv("BROWSER_PROFILES_DIR", "./profiles"))


def get_profile_dir(user_id: str) -> Path:
    """Get the browser profile directory for a user."""
    profile_dir = PROFILES_DIR / user_id
    profile_dir.mkdir(parents=True, exist_ok=True)
    return profile_dir


def has_profile(user_id: str) -> bool:
    """Check if a user has an existing browser profile with data."""
    profile_dir = PROFILES_DIR / user_id
    if not profile_dir.exists():
        return False
    default_dir = profile_dir / "Default"
    if default_dir.exists():
        cookies = default_dir / "Cookies"
        login_data = default_dir / "Login Data"
        return cookies.exists() or login_data.exists()
    return False


def find_chrome_binary() -> str:
    """Find the Chrome/Chromium binary on this system."""
    if platform.system() == "Windows":
        candidates = [
            os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        ]
    elif platform.system() == "Darwin":
        candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ]
    else:
        candidates = [
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
        ]

    for path in candidates:
        if os.path.exists(path):
            return path

    raise FileNotFoundError(
        "Chrome not found. Install Google Chrome or set CHROME_BINARY env var."
    )


def open_real_chrome_for_signin(
    user_id: str,
    url: str,
    profile_dir: str | None = None,
) -> subprocess.Popen:
    """
    Open a REAL Chrome window (no automation flags) for manual sign-in.

    This Chrome instance:
    - Has NO --remote-debugging-port (not detectable as automated)
    - Has NO --enable-automation flag
    - Uses the user's persistent profile directory for cookie storage
    - Looks and behaves exactly like normal Chrome to Google

    The user signs in manually. When they close the window, the session
    cookies are saved in the profile directory. Future automated runs
    using the same profile will find the user already logged in.
    """
    chrome = os.environ.get("CHROME_BINARY") or find_chrome_binary()
    profile = profile_dir or str(get_profile_dir(user_id))
    os.makedirs(profile, exist_ok=True)

    args = [
        chrome,
        f"--user-data-dir={os.path.abspath(profile)}",
        "--no-first-run",
        "--no-default-browser-check",
        # NO --remote-debugging-port
        # NO --enable-automation
        # NO --disable-blink-features=AutomationControlled
        # This is a REAL browser. Google sees nothing suspicious.
        url,
    ]

    print(f"[auth] Opening Chrome for manual sign-in...")
    print(f"[auth] Profile: {os.path.abspath(profile)}")
    print(f"[auth] URL: {url}")

    process = subprocess.Popen(
        args,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    return process


def get_browser_profile(user_id: str, headless: bool = True) -> BrowserProfile:
    """Create a BrowserProfile for automated booking (CDP mode).
    Uses system Chrome so saved cookies from manual sign-in are available."""
    profile_dir = get_profile_dir(user_id)
    return BrowserProfile(
        user_data_dir=str(profile_dir),
        headless=headless,
        channel="chrome",
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
        ],
    )


def verify_cookies_saved(profile_dir: str) -> list[tuple[str, int]]:
    """Check if cookie files exist in the profile directory. Returns list of (path, size)."""
    cookie_files = []
    for root, dirs, files in os.walk(profile_dir):
        for f in files:
            if "cookie" in f.lower():
                full = os.path.join(root, f)
                size = os.path.getsize(full)
                if size > 0:
                    cookie_files.append((full, size))
    return cookie_files
