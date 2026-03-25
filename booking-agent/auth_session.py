"""
Per-user authentication session management for the booking agent.

Manages studio-specific login sessions in Chrome profiles.
Tokens are encrypted at rest using Fernet symmetric encryption.

Auth strategy:
  1. User signs in via real Chrome (no automation flags) — cookies saved to profile
  2. Booking agent uses same profile with CDP — finds user already logged in
  3. If session expires, agent reports LOGIN_REQUIRED — user signs in again
"""

import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path

PROFILES_DIR = Path(os.getenv("BROWSER_PROFILES_DIR", "./profiles"))
SESSION_ENCRYPTION_KEY = os.getenv("SESSION_ENCRYPTION_KEY", "")


@dataclass
class UserAuthSession:
    """Authentication state for a GirlBot user."""

    user_id: str
    google_email: str
    google_name: str | None = None

    # Google credentials (encrypted at rest)
    google_password: str | None = None

    # Google OAuth tokens (encrypted at rest)
    google_access_token: str | None = None
    google_refresh_token: str | None = None
    google_id_token: str | None = None
    google_token_expiry: float | None = None  # Unix timestamp

    # Studio-specific sessions (domain → status)
    # Tracks which studios the user has signed into via real Chrome
    studio_sessions: dict[str, str] = field(default_factory=dict)
    # e.g. {"soul-cycle.com": "active", "corepoweryoga.com": "expired"}

    # Profile state
    google_session_seeded: bool = False
    last_session_seed: float | None = None  # Unix timestamp


def get_profile_path(user_id: str) -> Path:
    """Get the Chrome profile directory for a user."""
    path = PROFILES_DIR / user_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def _session_file(user_id: str) -> Path:
    return get_profile_path(user_id) / "girlbot_session.json"


def save_user_session(session: UserAuthSession) -> None:
    """Save user auth session to disk (tokens encrypted)."""
    data = {
        "user_id": session.user_id,
        "google_email": session.google_email,
        "google_name": session.google_name,
        "studio_sessions": session.studio_sessions,
        "google_session_seeded": session.google_session_seeded,
        "last_session_seed": session.last_session_seed,
        "google_token_expiry": session.google_token_expiry,
    }

    sensitive_fields = ("google_password", "google_access_token", "google_refresh_token", "google_id_token")

    if SESSION_ENCRYPTION_KEY:
        from cryptography.fernet import Fernet
        fernet = Fernet(SESSION_ENCRYPTION_KEY.encode())
        for field_name in sensitive_fields:
            val = getattr(session, field_name)
            if val:
                data[f"{field_name}_enc"] = fernet.encrypt(val.encode()).decode()
    else:
        has_sensitive = any(getattr(session, f) for f in sensitive_fields)
        if has_sensitive:
            print("[auth_session] WARNING: SESSION_ENCRYPTION_KEY not set, sensitive data stored in plaintext")
        for field_name in sensitive_fields:
            data[field_name] = getattr(session, field_name)

    path = _session_file(session.user_id)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def load_user_session(user_id: str) -> UserAuthSession | None:
    """Load user auth session from disk."""
    path = _session_file(user_id)
    if not path.exists():
        return None

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[auth_session] Failed to load session for {user_id}: {e}")
        return None

    session = UserAuthSession(
        user_id=data["user_id"],
        google_email=data["google_email"],
        google_name=data.get("google_name"),
        studio_sessions=data.get("studio_sessions", {}),
        google_session_seeded=data.get("google_session_seeded", False),
        last_session_seed=data.get("last_session_seed"),
        google_token_expiry=data.get("google_token_expiry"),
    )

    # Decrypt sensitive fields
    sensitive_fields = ("google_password", "google_access_token", "google_refresh_token", "google_id_token")
    if SESSION_ENCRYPTION_KEY:
        from cryptography.fernet import Fernet
        fernet = Fernet(SESSION_ENCRYPTION_KEY.encode())
        for field_name in sensitive_fields:
            enc_key = f"{field_name}_enc"
            if enc_key in data:
                try:
                    setattr(session, field_name, fernet.decrypt(data[enc_key].encode()).decode())
                except Exception:
                    print(f"[auth_session] Failed to decrypt {field_name} for {user_id}")
    else:
        for field_name in sensitive_fields:
            setattr(session, field_name, data.get(field_name))

    return session


def check_session_health(user_id: str, domain: str | None = None) -> str:
    """
    Check if the user's session is likely still valid.
    Returns: "google_active", "studio_active", "expired", "never_logged_in"
    """
    session = load_user_session(user_id)
    if not session:
        return "never_logged_in"

    # Check studio-specific session first (most relevant for booking)
    if domain:
        studio_status = session.studio_sessions.get(domain)
        if studio_status == "active":
            return "studio_active"

    # Check Google session age (Chrome profiles keep sessions ~7 days)
    if session.google_session_seeded and session.last_session_seed:
        age_hours = (time.time() - session.last_session_seed) / 3600
        if age_hours < 168:  # 7 days
            return "google_active"

    return "expired" if session.google_session_seeded else "never_logged_in"


def mark_studio_session(user_id: str, domain: str, status: str = "active") -> None:
    """Mark a studio-specific session as active or expired."""
    session = load_user_session(user_id)
    if not session:
        return
    session.studio_sessions[domain] = status
    save_user_session(session)


def invalidate_studio_session(user_id: str, domain: str) -> None:
    """Mark a studio session as expired (e.g., when auth redirect detected despite saved session)."""
    mark_studio_session(user_id, domain, "expired")


def do_manual_signin(
    user_id: str,
    studio_name: str,
    url: str,
    domain: str | None = None,
) -> dict:
    """
    Open a real Chrome window for the user to sign in to a studio.
    Waits for the user to close Chrome, then verifies cookies were saved.

    This is NOT automated — it opens a completely normal Chrome window.
    Google cannot detect or block this because there's nothing to detect.
    """
    from browser_profiles import open_real_chrome_for_signin, verify_cookies_saved

    profile_dir = str(get_profile_path(user_id))

    print(f"\n{'='*60}")
    print(f"SIGN IN TO {studio_name.upper()}")
    print(f"{'='*60}")
    print(f"A Chrome window will open to: {url}")
    print()
    print(f"Please:")
    print(f"  1. Sign in to {studio_name} using any method")
    print(f"     (Google, email/password, create account — whatever works)")
    print(f"  2. Make sure you see your account/profile after signing in")
    print(f"  3. Close the Chrome window when done")
    print()
    print(f"Your login will be saved for all future bookings at {studio_name}.")
    print(f"{'='*60}\n")

    process = open_real_chrome_for_signin(
        user_id=user_id,
        url=url,
        profile_dir=profile_dir,
    )

    # Wait for the user to close Chrome
    print("[auth] Waiting for you to sign in and close Chrome...")
    process.wait()
    print("[auth] Chrome closed.")

    # Give Chrome a moment to flush cookies to disk
    time.sleep(2)

    # Verify cookies were saved
    cookie_files = verify_cookies_saved(profile_dir)

    if cookie_files:
        print(f"[auth] Session saved! Found {len(cookie_files)} cookie file(s):")
        for path, size in cookie_files:
            print(f"  {path} ({size:,} bytes)")
    else:
        print("[auth] WARNING: No cookie files found. The sign-in may not have saved.")
        print(f"[auth] Check the profile directory: {profile_dir}")
        return {
            "success": False,
            "message": "No cookie files found after sign-in. Try again.",
        }

    # Update the user session record
    if not domain:
        domain = url.split("//")[-1].split("/")[0].replace("www.", "")

    session = load_user_session(user_id) or UserAuthSession(
        user_id=user_id, google_email="(manual sign-in)"
    )
    session.studio_sessions[domain] = "active"
    session.google_session_seeded = True
    session.last_session_seed = time.time()
    save_user_session(session)

    print(f"\n[auth] Done! Future bookings at {studio_name} will use this session.")
    return {
        "success": True,
        "message": f"Login to {studio_name} saved. Future bookings will use this session.",
        "domain": domain,
    }
