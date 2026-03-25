"""
Site memory system for the universal booking agent.

Stores per-domain site profiles as JSON files in site_profiles/{domain}.json.
Profiles accumulate strategic knowledge about how to navigate each studio's
booking flow, enabling faster and more reliable repeat visits.
"""

import json
import os
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from urllib.parse import urlparse

PROFILES_DIR = Path(__file__).parent / "site_profiles"
PROFILES_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class SiteProfile:
    domain: str
    studio_name: str = ""
    platform_type: str = ""  # e.g., "react-spa", "wordpress", "mindbody-embed", "custom"
    booking_url: str = ""
    auth_method: str = ""  # e.g., "google-sso", "email-password", "none", "mixed"
    schedule_description: str = ""
    schedule_url: str = ""  # URL where the class schedule was found
    flow_steps: list[str] = field(default_factory=list)
    obstacles: list[str] = field(default_factory=list)
    tips: list[str] = field(default_factory=list)
    class_types_observed: list[str] = field(default_factory=list)
    has_location_picker: bool = False
    has_spot_selection: bool = False
    confidence: float = 0.0
    visit_count: int = 0
    success_count: int = 0
    fail_count: int = 0
    last_visited: str = ""
    created_at: str = ""
    # Navigation efficiency tracking
    best_steps_to_schedule: int | None = None
    avg_steps_to_schedule: float | None = None
    steps_history: list[int] = field(default_factory=list)


def extract_domain(url: str) -> str:
    """Extract hostname without 'www.' from a URL."""
    if not url:
        return ""
    try:
        parsed = urlparse(url if "://" in url else f"https://{url}")
        hostname = parsed.hostname or ""
        if hostname.startswith("www."):
            hostname = hostname[4:]
        return hostname
    except Exception:
        return ""


def _profile_path(domain: str) -> Path:
    """Get the file path for a domain's profile."""
    safe_name = domain.replace("/", "_").replace("\\", "_")
    return PROFILES_DIR / f"{safe_name}.json"


# ═══════════════════════════════════════════════════════════════════════
# Seed profiles — initial knowledge for known sites
# ═══════════════════════════════════════════════════════════════════════

SEED_PROFILES: dict[str, SiteProfile] = {
    "soul-cycle.com": SiteProfile(
        domain="soul-cycle.com",
        studio_name="SoulCycle",
        platform_type="react-spa",
        booking_url="https://www.soul-cycle.com/",
        auth_method="google-sso",
        schedule_description=(
            "Schedule loads dynamically after selecting a studio. "
            "Date tabs at the top, class cards below with time, instructor, theme. "
            "Each card has a Reserve button (or Waitlist if full)."
        ),
        flow_steps=[
            "Navigate to soul-cycle.com and click 'Book a Bike' in top nav",
            "Select the correct city/region from the dropdown (defaults to NYC)",
            "Select the target studio from the studio list",
            "Authenticate via Google SSO if not already logged in",
            "Navigate to the correct date using date tabs",
            "Find the target class and click 'Reserve'",
            "Select a bike from the seat map (click any available position)",
            "Confirm the booking (uses existing credits)",
        ],
        obstacles=[
            "City selector defaults to NYC — must change for non-NYC studios",
            "Cookie consent banner may appear on first visit — dismiss it",
            "Promotional popup may appear — close it (X or 'No thanks')",
            "Schedule takes 3-5 seconds to load after navigation",
            "Google OAuth popup needs 5-10 seconds to complete before interacting",
            "After auth popup closes, page may need a moment to update",
            "If page appears blank after navigation, wait 3-5s then scroll",
            "If stuck on same page 3+ steps, try refreshing once",
        ],
        tips=[
            "SoulCycle is a React SPA — always wait for dynamic content",
            "If direct booking URL 404s, go to homepage and find booking from nav",
            "Do NOT keep scrolling the same dropdown — if studio not found, change city first",
            "After selecting a bike, if redirected to 'Buy Series' or 'Welcome to SoulCycle' "
            "with pricing (e.g. 'New Rider 1 Class $20'), user has NO credits — report PAYMENT_REQUIRED",
            "Clicking 'Confirm' to USE an existing credit is OK — that's not a purchase",
            "If Google account picker appears, select the correct email",
            "If SSO fails, try email/password login as fallback",
            "Studios page at /studios/ can be used to browse all locations",
        ],
        class_types_observed=["Cycling"],
        has_location_picker=True,
        has_spot_selection=True,
        confidence=0.8,
        visit_count=0,
        success_count=0,
        fail_count=0,
        last_visited="",
        created_at="",
    ),
}


def load_profile(domain: str) -> SiteProfile | None:
    """Load a site profile from disk, or seed it if this is a known domain."""
    if not domain:
        return None

    path = _profile_path(domain)

    # Try loading from file
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            # Handle profiles saved before new fields were added
            known_fields = {f.name for f in SiteProfile.__dataclass_fields__.values()}
            filtered = {k: v for k, v in data.items() if k in known_fields}
            return SiteProfile(**filtered)
        except Exception as e:
            print(f"[site_memory] Failed to load profile for {domain}: {e}")

    # Check seed profiles
    if domain in SEED_PROFILES:
        profile = SEED_PROFILES[domain]
        profile.created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        save_profile(profile)
        return profile

    return None


def save_profile(profile: SiteProfile) -> None:
    """Save a site profile to disk atomically."""
    path = _profile_path(profile.domain)
    tmp_path = path.with_suffix(".tmp")
    try:
        tmp_path.write_text(
            json.dumps(asdict(profile), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        os.replace(str(tmp_path), str(path))
    except Exception as e:
        print(f"[site_memory] Failed to save profile for {profile.domain}: {e}")
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass


def format_profile_for_prompt(profile: SiteProfile) -> str:
    """Format a site profile as a readable text block for prompt injection."""
    if not profile or (profile.confidence <= 0 and profile.visit_count == 0):
        return ""

    lines = [f"SITE MEMORY — {profile.studio_name or profile.domain} (confidence: {profile.confidence:.1f}):"]

    if profile.platform_type:
        lines.append(f"  Platform: {profile.platform_type}")
    if profile.auth_method:
        lines.append(f"  Auth method: {profile.auth_method}")
    if profile.has_location_picker:
        lines.append("  Has location/city picker: YES — you must select a location before the schedule appears")
    if profile.has_spot_selection:
        lines.append("  Has bike/spot selection: YES")
    if profile.schedule_url:
        lines.append(f"  Schedule URL: {profile.schedule_url}")
    if profile.schedule_description:
        lines.append(f"  Schedule: {profile.schedule_description}")

    if profile.flow_steps:
        lines.append("  Known booking flow:")
        for i, step in enumerate(profile.flow_steps, 1):
            lines.append(f"    {i}. {step}")

    if profile.obstacles:
        lines.append("  Known obstacles:")
        for obs in profile.obstacles:
            lines.append(f"    - {obs}")

    if profile.tips:
        lines.append("  Tips:")
        for tip in profile.tips:
            lines.append(f"    - {tip}")

    if profile.class_types_observed:
        lines.append(f"  Class types seen: {', '.join(profile.class_types_observed)}")

    if profile.best_steps_to_schedule is not None:
        lines.append(f"  Best steps to reach schedule: {profile.best_steps_to_schedule}")

    return "\n".join(lines)


def _deduplicate_list(existing: list[str], new_items: list[str]) -> list[str]:
    """Union two lists, deduplicating by substring containment."""
    result = list(existing)
    for item in new_items:
        item_lower = item.lower().strip()
        if not item_lower:
            continue
        is_dup = False
        for existing_item in result:
            existing_lower = existing_item.lower().strip()
            if item_lower in existing_lower or existing_lower in item_lower:
                is_dup = True
                break
        if not is_dup:
            result.append(item)
    return result


# ═══════════════════════════════════════════════════════════════════════
# Inline observation extraction — no LLM, runs per-step during the agent
# ═══════════════════════════════════════════════════════════════════════

# Keywords that indicate the agent has found the class schedule
_SCHEDULE_KEYWORDS = [
    "class schedule", "class cards", "classes loaded", "found classes",
    "classes available", "available yoga", "available cycling",
    "schedule for", "schedule page", "schedule section",
    "classes for", "book button", "reserve button",
]

# Keywords that indicate a location/studio picker was used
_LOCATION_KEYWORDS = [
    "select location", "chose studio", "selected studio", "location picker",
    "studio location", "select a studio", "selected city", "chose city",
    "studio from the list", "studio from the dropdown",
    "yoga studios", "studio selection",
]

# URL patterns that indicate an auth redirect
_AUTH_URL_PATTERNS = ["/login", "/signin", "/sign-in", "/profile", "/auth", "/account", "/sso"]

# URL patterns indicating a schedule page
_SCHEDULE_URL_PATTERNS = ["/schedule", "/classes", "/book", "/find-a-class", "/yoga-schedules"]


def extract_inline_observations(step_log: dict) -> dict:
    """Extract site observations from a single agent step. No LLM call."""
    observations = {}

    url = (step_log.get("url") or "").lower()
    action = (step_log.get("action") or "").lower()
    eval_text = step_log.get("eval") or ""
    memory = step_log.get("memory") or ""
    goal = step_log.get("goal") or ""
    combined = f"{eval_text} {memory} {goal}".lower()

    # Detect platform from URL
    if "mindbodyonline.com" in url or "mindbody" in url:
        observations["platform_type"] = "mindbody"
    elif "classpass.com" in url:
        observations["platform_type"] = "classpass"
    elif "marianaiframes" in url:
        observations["platform_type"] = "mariana-tek"

    # Detect schedule found
    if any(kw in combined for kw in _SCHEDULE_KEYWORDS):
        observations["schedule_found"] = True
        observations["schedule_url"] = step_log.get("url") or ""

    # Detect auth redirect
    if any(pat in url for pat in _AUTH_URL_PATTERNS):
        observations["auth_redirect_detected"] = True

    # Detect login method from agent's memory/eval
    if "sign in with google" in combined or "continue with google" in combined or "google sso" in combined:
        observations["auth_method_hint"] = "google-sso"
        observations["google_sso_available"] = True
    elif "no google" in combined and ("sign in" in combined or "login" in combined or "sso" in combined):
        observations["google_sso_available"] = False
    elif "create an account" in combined or "email and password" in combined:
        observations["auth_method_hint"] = "email-password"

    # Detect location picker used
    if any(kw in combined for kw in _LOCATION_KEYWORDS):
        observations["has_location_picker"] = True

    # Detect spot/bike selection
    if "seat" in combined or "bike" in combined or "spot" in combined or "mat" in combined:
        if "select" in combined or "chose" in combined or "clicked" in combined:
            observations["has_spot_selection"] = True

    # Detect schedule URL from URL patterns
    if any(pat in url for pat in _SCHEDULE_URL_PATTERNS):
        observations["schedule_url_candidate"] = step_log.get("url") or ""

    return observations


def merge_inline_observations(accumulated: dict, new_obs: dict, step_num: int) -> None:
    """Merge a single step's observations into the accumulated dict. Mutates accumulated."""
    for key, val in new_obs.items():
        if key == "schedule_found" and val:
            # Record the first step where schedule was found
            if "steps_to_schedule" not in accumulated:
                accumulated["steps_to_schedule"] = step_num
            accumulated["schedule_found"] = True
        elif key == "schedule_url" and val:
            accumulated["schedule_url"] = val
        elif key == "schedule_url_candidate" and val:
            # Only use as fallback if no explicit schedule_url
            if "schedule_url" not in accumulated:
                accumulated["schedule_url"] = val
        elif key in ("has_location_picker", "has_spot_selection", "auth_redirect_detected"):
            if val:
                accumulated[key] = True
        elif key in ("platform_type", "auth_method_hint"):
            if val and key not in accumulated:
                accumulated[key] = val


# ═══════════════════════════════════════════════════════════════════════
# Graduated confidence calculation
# ═══════════════════════════════════════════════════════════════════════

def _confidence_delta(result_status: str, found_schedule: bool) -> float:
    """Calculate confidence adjustment based on depth reached."""
    if result_status in ("booked", "already_registered"):
        return 0.3
    elif result_status == "payment_required":
        return 0.2   # Got through the whole flow, just needs credits
    elif result_status == "class_full":
        return 0.15  # Found the class, it's just full
    elif result_status == "login_required":
        return 0.1   # Found the schedule, auth blocked
    elif result_status == "blocked":
        return 0.05  # Learned the site blocks bots
    elif result_status == "error":
        if found_schedule:
            return 0.05  # At least found the schedule
        return -0.05
    return 0.0


# ═══════════════════════════════════════════════════════════════════════
# Main learning function
# ═══════════════════════════════════════════════════════════════════════

async def learn_from_attempt(
    domain: str,
    studio_name: str,
    result_status: str,
    agent_final_output: str | None,
    step_history: list[dict] | None,
    start_url: str | None,
    inline_observations: dict | None,
) -> None:
    """Extract observations from an agent run and merge into the site profile.

    Uses inline observations (captured per-step, no LLM) as the primary source,
    then enriches with a gpt-4o-mini call using step history + URL trail.
    Fire-and-forget — if extraction fails, the booking result is unaffected.
    """
    if not domain:
        return

    inline_obs = inline_observations or {}
    steps = step_history or []
    final_output = agent_final_output or ""
    found_schedule = inline_obs.get("schedule_found", False)

    # Load or create profile
    profile = load_profile(domain) or SiteProfile(
        domain=domain,
        created_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    )

    # ── Apply inline observations (always available, even on timeout) ──

    if studio_name:
        profile.studio_name = studio_name

    if inline_obs.get("platform_type"):
        profile.platform_type = inline_obs["platform_type"]
    if inline_obs.get("schedule_url"):
        profile.schedule_url = inline_obs["schedule_url"]
        if not profile.booking_url:
            profile.booking_url = inline_obs["schedule_url"]
    if inline_obs.get("has_location_picker"):
        profile.has_location_picker = True
    if inline_obs.get("has_spot_selection"):
        profile.has_spot_selection = True
    if inline_obs.get("auth_redirect_detected") and not profile.auth_method:
        profile.auth_method = inline_obs.get("auth_method_hint", "email-password")
    elif inline_obs.get("auth_method_hint") and not profile.auth_method:
        profile.auth_method = inline_obs["auth_method_hint"]

    # ── Track steps-to-schedule ──

    steps_to_sched = inline_obs.get("steps_to_schedule")
    if steps_to_sched is not None:
        profile.steps_history.append(steps_to_sched)
        if profile.best_steps_to_schedule is None or steps_to_sched < profile.best_steps_to_schedule:
            profile.best_steps_to_schedule = steps_to_sched
        profile.avg_steps_to_schedule = sum(profile.steps_history) / len(profile.steps_history)

    # ── Enrich with LLM call using all available context ──

    try:
        # Build rich context from step history
        urls_visited = []
        step_summaries = []
        for s in steps:
            url = s.get("url", "")
            if url:
                urls_visited.append(url)
            goal = s.get("goal", "")
            action = s.get("action", "")
            memory = s.get("memory", "")
            step_num = s.get("step", "?")
            step_summaries.append(f"  Step {step_num}: {goal} (action: {action})")
            if memory:
                step_summaries.append(f"    Memory: {memory}")
            if url:
                step_summaries.append(f"    URL: {url}")

        # Only call the LLM if we have meaningful context
        has_context = bool(step_summaries) or bool(final_output.strip())
        if has_context:
            from openai import AsyncOpenAI
            client = AsyncOpenAI()

            context_parts = [
                f"Domain: {domain}",
                f"Studio name: {studio_name}",
                f"Start URL: {start_url or 'unknown'}",
                f"Booking result: {result_status}",
            ]

            if urls_visited:
                unique_urls = list(dict.fromkeys(urls_visited))  # preserve order, dedup
                context_parts.append(f"\nURLs visited (in order):\n" + "\n".join(f"  {u}" for u in unique_urls))

            if step_summaries:
                context_parts.append(f"\nStep history:\n" + "\n".join(step_summaries))

            if inline_obs:
                context_parts.append(f"\nInline observations already extracted:\n{json.dumps(inline_obs, indent=2)}")

            if final_output.strip():
                context_parts.append(f"\nAgent's final output:\n{final_output[:2000]}")

            extraction_prompt = f"""Analyze this booking agent's run on a fitness studio website and extract structured observations.

{chr(10).join(context_parts)}

Based on the above, extract a JSON object with these fields (use empty string/list if truly unknown):
{{
  "platform_type": "Type of site (react-spa, wordpress, mindbody-embed, custom, etc.)",
  "booking_url": "URL where the booking/schedule page was found",
  "auth_method": "How login works (google-sso, email-password, none, mixed)",
  "schedule_description": "Brief description of how the schedule page is organized",
  "flow_steps": ["Step 1 description", "Step 2 description", ...],
  "obstacles": ["Any issues encountered"],
  "tips": ["Useful tips for navigating this site faster next time"],
  "class_types_observed": ["Class types seen on the schedule"],
  "has_location_picker": true/false,
  "has_spot_selection": true/false
}}"""

            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": extraction_prompt}],
                response_format={"type": "json_object"},
                temperature=0,
            )

            observations = json.loads(response.choices[0].message.content)

            # Merge LLM observations into profile
            succeeded = result_status in ("booked", "already_registered")

            # flow_steps: replace only if this attempt succeeded
            if succeeded and observations.get("flow_steps"):
                profile.flow_steps = observations["flow_steps"]

            # Union lists
            if observations.get("obstacles"):
                profile.obstacles = _deduplicate_list(profile.obstacles, observations["obstacles"])
            if observations.get("tips"):
                profile.tips = _deduplicate_list(profile.tips, observations["tips"])
            if observations.get("class_types_observed"):
                profile.class_types_observed = _deduplicate_list(
                    profile.class_types_observed, observations["class_types_observed"]
                )

            # Overwrite with non-empty values (LLM fills gaps inline missed)
            for field_name in ("platform_type", "auth_method", "schedule_description", "booking_url"):
                val = observations.get(field_name, "")
                if val and not getattr(profile, field_name, ""):
                    setattr(profile, field_name, val)

            # Only upgrade booleans to True
            if observations.get("has_location_picker"):
                profile.has_location_picker = True
            if observations.get("has_spot_selection"):
                profile.has_spot_selection = True

    except Exception as e:
        print(f"[site_memory] LLM extraction failed (using inline observations only): {e}")

    # ── Update counters and confidence ──

    profile.visit_count += 1
    delta = _confidence_delta(result_status, found_schedule)
    profile.confidence = max(0.0, min(1.0, profile.confidence + delta))

    if result_status in ("booked", "already_registered"):
        profile.success_count += 1
    else:
        profile.fail_count += 1

    profile.last_visited = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # Persist
    save_profile(profile)
    print(f"[site_memory] Updated profile for {domain} "
          f"(confidence: {profile.confidence:.2f}, "
          f"steps_to_schedule: {steps_to_sched or 'N/A'})")


def list_profiles() -> list[dict]:
    """List all stored site profiles with summary info."""
    profiles = []
    for path in PROFILES_DIR.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            profiles.append({
                "domain": data.get("domain", path.stem),
                "studio_name": data.get("studio_name", ""),
                "confidence": data.get("confidence", 0),
                "visit_count": data.get("visit_count", 0),
                "success_count": data.get("success_count", 0),
                "fail_count": data.get("fail_count", 0),
                "last_visited": data.get("last_visited", ""),
                "best_steps_to_schedule": data.get("best_steps_to_schedule"),
            })
        except Exception:
            continue
    return profiles


def get_profile_detail(domain: str) -> dict | None:
    """Get full profile detail for a domain."""
    profile = load_profile(domain)
    if profile:
        return asdict(profile)
    return None
