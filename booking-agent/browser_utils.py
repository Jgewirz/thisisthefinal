"""
Browser launch utilities -- stale process cleanup, profile lock removal,
port availability checks, and pre-flight validation.
"""

import os
import platform
import socket
import subprocess
import time
from pathlib import Path

PROFILES_DIR = Path(os.getenv("BROWSER_PROFILES_DIR", "./profiles"))


def kill_stale_browsers(profile_dir: str | None = None) -> None:
    """Kill orphaned Chrome/Chromium processes that may hold a profile lock.

    If profile_dir is provided, only kills processes using that directory.
    Otherwise kills all chrome/chromium processes (use with caution).
    """
    try:
        if platform.system() == "Windows":
            if profile_dir:
                # Use WMIC to find chrome processes with this profile dir
                result = subprocess.run(
                    ["wmic", "process", "where",
                     f"name='chrome.exe' and CommandLine like '%{profile_dir}%'",
                     "get", "ProcessId"],
                    capture_output=True, text=True, timeout=10,
                )
                for line in result.stdout.strip().splitlines():
                    pid = line.strip()
                    if pid.isdigit():
                        subprocess.run(
                            ["taskkill", "/F", "/PID", pid, "/T"],
                            capture_output=True, timeout=5,
                        )
            else:
                subprocess.run(
                    ["taskkill", "/F", "/IM", "chrome.exe", "/T"],
                    capture_output=True, timeout=10,
                )
                subprocess.run(
                    ["taskkill", "/F", "/IM", "chromium.exe", "/T"],
                    capture_output=True, timeout=10,
                )
        else:
            if profile_dir:
                subprocess.run(
                    ["pkill", "-f", f"chrome.*{profile_dir}"],
                    capture_output=True, timeout=10,
                )
            else:
                subprocess.run(["pkill", "-f", "chrome"], capture_output=True, timeout=10)
                subprocess.run(["pkill", "-f", "chromium"], capture_output=True, timeout=10)
    except Exception as e:
        print(f"[browser_utils] kill_stale_browsers: {e}")


def clear_profile_lock(profile_path: str) -> None:
    """Remove stale Chrome profile lock files from a crashed session.

    Waits 3 seconds before attempting removal to let Windows release file handles
    after kill_stale_browsers() terminates Chrome processes.
    """
    lock_files = ["SingletonLock", "SingletonSocket", "SingletonCookie", "lockfile"]
    has_locks = any(os.path.exists(os.path.join(profile_path, lf)) for lf in lock_files)

    if has_locks:
        print("[browser_utils] Waiting 3s for OS to release lock file handles...")
        time.sleep(3)

    for lock in lock_files:
        lock_path = os.path.join(profile_path, lock)
        if os.path.exists(lock_path):
            # Retry up to 3 times with 1s delay on failure
            for attempt in range(3):
                try:
                    os.remove(lock_path)
                    print(f"[browser_utils] Removed stale lock: {lock_path}")
                    break
                except OSError as e:
                    if attempt < 2:
                        time.sleep(1)
                    else:
                        print(f"[browser_utils] Could not remove {lock_path} after 3 attempts: {e}")


def is_port_available(port: int) -> bool:
    """Check if a port is available for Chrome's debug interface."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def find_available_debug_port(start: int = 9222, max_attempts: int = 10) -> int:
    """Find an available port for Chrome DevTools Protocol."""
    for offset in range(max_attempts):
        port = start + offset
        if is_port_available(port):
            return port
    raise RuntimeError(f"No available debug ports in range {start}-{start + max_attempts}")


def preflight_check(profile_dir: str | None = None) -> list[str]:
    """Verify browser automation prerequisites. Returns list of issues (empty = all good)."""
    issues = []

    # 1. Check OpenAI API key
    if not os.getenv("OPENAI_API_KEY"):
        issues.append("OPENAI_API_KEY not set")

    # 2. Check Playwright browsers installed
    try:
        result = subprocess.run(
            ["python", "-m", "playwright", "install", "--dry-run", "chromium"],
            capture_output=True, text=True, timeout=15,
        )
        # If dry-run fails or mentions "not installed", flag it
        if result.returncode != 0 and "already installed" not in result.stdout.lower():
            # Try a simpler check -- just see if playwright is importable
            pass
    except Exception:
        # Don't fail on this -- playwright may still work
        pass

    # 3. Check profile directory writable (if specified)
    if profile_dir:
        profile_path = Path(profile_dir)
        try:
            profile_path.mkdir(parents=True, exist_ok=True)
            test_file = profile_path / ".write_test"
            test_file.write_text("test")
            test_file.unlink()
        except OSError as e:
            issues.append(f"Profile directory not writable: {profile_dir} ({e})")

        # Check for stale locks
        for lock in ["SingletonLock", "SingletonSocket", "SingletonCookie", "lockfile"]:
            if (profile_path / lock).exists():
                issues.append(f"Stale lock file found: {lock} (will be auto-cleaned)")

    # 4. Check default debug port
    if not is_port_available(9222):
        issues.append("Port 9222 is in use (Chrome debug port conflict)")

    return issues


async def check_url_reachable(url: str, timeout: int = 10) -> tuple[bool, int | None]:
    """Check if a URL is reachable via HEAD request. Returns (reachable, status_code)."""
    import aiohttp
    try:
        async with aiohttp.ClientSession() as client:
            async with client.head(url, timeout=aiohttp.ClientTimeout(total=timeout),
                                   allow_redirects=True) as resp:
                return (resp.status < 400, resp.status)
    except Exception:
        return (False, None)


def get_homepage_url(url: str) -> str:
    """Extract the homepage URL from a full URL (scheme + domain only)."""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}/"


def set_browser_launch_timeout(timeout_seconds: int = 90) -> None:
    """Set the browser-use event bus timeout for browser startup.

    The bubus event handler timeout for BrowserStartEvent defaults to 30s.
    This sets it via environment variable before browser-use imports process it.
    """
    os.environ.setdefault("TIMEOUT_BrowserStartEvent", str(timeout_seconds))
    os.environ.setdefault("TIMEOUT_BrowserLaunchEvent", str(timeout_seconds))
