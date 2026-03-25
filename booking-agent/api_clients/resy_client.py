"""
Resy API Client — direct HTTP, no browser automation.

Authentication flow:
1. Static API key (embedded in Resy's web app JS, same for all users)
2. Login with email/password → auth token (45 days) + payment method
3. Use auth token in X-Resy-Auth-Token header for authenticated requests
4. Token persistence in profiles/{user_id}/resy_tokens.json

Booking flow (~2 seconds total):
  login → search venue → get slots → get slot details → book

References:
  - github.com/daylamtayari/cierge (Go, most thorough API docs)
  - github.com/musemen/resy-mcp-server (Python, full MCP integration)
  - github.com/emandel2630/Resy-Bot (Python, clean booking flow)
"""

import httpx
import json
import time
from dataclasses import dataclass
from pathlib import Path

# Static API key from Resy's web app JS — same for all users, public.
# If it changes, parse it from https://widgets.resy.com/ JS bundle.
DEFAULT_API_KEY = "VbWk7s3L4KiK5fzlO7JD3Q5EYolJI7n5"

RESY_BASE_URL = "https://api.resy.com"


@dataclass
class ResyTokens:
    api_key: str = DEFAULT_API_KEY
    auth_token: str | None = None
    refresh_token: str | None = None
    token_expiry: float | None = None
    payment_method_id: int | None = None
    user_id: int | None = None


class ResyClient:
    """Direct HTTP client for Resy's REST API."""

    def __init__(self, tokens: ResyTokens | None = None):
        self.tokens = tokens or ResyTokens()
        self.http = httpx.AsyncClient(
            base_url=RESY_BASE_URL,
            timeout=30.0,
            headers={
                "Authorization": f'ResyAPI api_key="{self.tokens.api_key}"',
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
                "Origin": "https://resy.com",
                "Referer": "https://resy.com/",
            },
        )

    def _auth_headers(self) -> dict:
        """Add user auth token to request headers."""
        if not self.tokens.auth_token:
            raise ValueError("Not authenticated. Call login() first.")
        return {
            "X-Resy-Auth-Token": self.tokens.auth_token,
            "X-Resy-Universal-Auth": self.tokens.auth_token,
        }

    @property
    def is_authenticated(self) -> bool:
        return self.tokens.auth_token is not None

    # ─── Authentication ─────────────────────────────────────────

    async def login(self, email: str, password: str) -> dict:
        """
        Login with email/password.
        Endpoint: POST /4/auth/password
        Returns user object with auth token.
        """
        resp = await self.http.post(
            "/4/auth/password",
            data={"email": email, "password": password},
        )
        resp.raise_for_status()
        data = resp.json()

        self.tokens.auth_token = data.get("token")
        self.tokens.user_id = data.get("id")
        self.tokens.payment_method_id = data.get("payment_method_id")
        self.tokens.token_expiry = time.time() + (45 * 24 * 3600)  # ~45 days

        # Extract payment methods
        payment_methods = data.get("payment_methods", [])
        if payment_methods and not self.tokens.payment_method_id:
            self.tokens.payment_method_id = payment_methods[0].get("id")

        return data

    async def refresh_auth(self, refresh_token: str) -> dict:
        """Refresh an expired auth token."""
        resp = await self.http.post(
            "/3/auth/token/refresh",
            data={"refresh_token": refresh_token},
            headers=self._auth_headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        self.tokens.auth_token = data.get("token")
        self.tokens.token_expiry = time.time() + (45 * 24 * 3600)
        return data

    # ─── Search ─────────────────────────────────────────────────

    async def search_venues(
        self,
        query: str,
        lat: float | None = None,
        lng: float | None = None,
        page_limit: int = 10,
        date: str | None = None,
        party_size: int = 2,
    ) -> list[dict]:
        """
        Search for restaurants. No auth required (just API key).
        Endpoint: POST /3/venuesearch/search
        """
        body: dict = {
            "query": query,
            "per_page": page_limit,
            "types": ["venue"],
        }
        if lat and lng:
            body["geo"] = {
                "latitude": lat,
                "longitude": lng,
                "radius": 16100,  # ~10 miles
            }
        if date:
            body["availability"] = True
            body["slot_filter"] = {
                "day": date,
                "party_size": party_size,
            }

        resp = await self.http.post(
            "/3/venuesearch/search",
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()
        # Response structure: { "search": { "hits": [...] } }
        hits = data.get("search", {}).get("hits", [])
        if hits:
            return hits
        # Fallback: older response format
        return data.get("results", {}).get("venues", [])

    async def get_venue(self, venue_id: int) -> dict:
        """Get full venue details (requires auth). Endpoint: GET /3/venue?id={venue_id}"""
        resp = await self.http.get(
            "/3/venue",
            params={"id": venue_id},
            headers=self._auth_headers(),
        )
        resp.raise_for_status()
        return resp.json()

    async def get_venue_calendar(
        self,
        venue_id: int,
        num_seats: int = 2,
        start_date: str = "",
        end_date: str = "",
    ) -> list[dict]:
        """
        Get calendar availability for a venue (which dates have open slots).
        Endpoint: GET /4/venue/calendar
        """
        params: dict = {"venue_id": venue_id, "num_seats": num_seats}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date

        resp = await self.http.get(
            "/4/venue/calendar",
            params=params,
            headers=self._auth_headers(),
        )
        resp.raise_for_status()
        return resp.json().get("scheduled", [])

    # ─── Availability ───────────────────────────────────────────

    async def get_slots(
        self,
        venue_id: int,
        date: str,
        party_size: int = 2,
    ) -> list[dict]:
        """
        Get available time slots for a specific date.
        Endpoint: POST /4/find
        Returns slot objects with config tokens needed for booking.
        """
        body = {
            "venue_id": venue_id,
            "day": date,
            "party_size": party_size,
            "lat": 0,
            "long": 0,
        }
        resp = await self.http.post(
            "/4/find",
            data=body,
            headers=self._auth_headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        venues = data.get("results", {}).get("venues", [])
        if not venues:
            return []
        return venues[0].get("slots", [])

    async def get_slot_details(
        self,
        config_id: str,
        date: str,
        party_size: int,
    ) -> dict:
        """
        Get details for a specific slot (needed before booking).
        Endpoint: POST /3/details
        Returns booking token and payment info.
        """
        body = {
            "config_id": config_id,
            "day": date,
            "party_size": party_size,
        }
        resp = await self.http.post(
            "/3/details",
            data=body,
            headers=self._auth_headers(),
        )
        resp.raise_for_status()
        return resp.json()

    # ─── Booking ────────────────────────────────────────────────

    async def book_reservation(
        self,
        book_token: str,
        payment_method_id: int | None = None,
    ) -> dict:
        """
        Book a reservation.
        Endpoint: POST /3/book
        Requires auth token.
        """
        pm_id = payment_method_id or self.tokens.payment_method_id
        body: dict = {
            "book_token": book_token,
            "source_id": "resy.com-venue-details",
        }
        if pm_id:
            body["struct_payment_method"] = json.dumps({"id": pm_id})

        resp = await self.http.post(
            "/3/book",
            data=body,
            headers=self._auth_headers(),
        )
        resp.raise_for_status()
        return resp.json()

    async def cancel_reservation(self, resy_token: str) -> dict:
        """Cancel a reservation. Endpoint: POST /3/cancel"""
        resp = await self.http.post(
            "/3/cancel",
            json={"resy_token": resy_token},
            headers=self._auth_headers(),
        )
        resp.raise_for_status()
        return resp.json()

    async def get_reservations(self) -> list[dict]:
        """Get user's upcoming reservations. Endpoint: GET /3/user/reservations"""
        resp = await self.http.get(
            "/3/user/reservations",
            headers=self._auth_headers(),
        )
        resp.raise_for_status()
        return resp.json()

    # ─── Token persistence ──────────────────────────────────────

    def save_tokens(self, path: str):
        """Save tokens to disk."""
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        data = {
            "api_key": self.tokens.api_key,
            "auth_token": self.tokens.auth_token,
            "refresh_token": self.tokens.refresh_token,
            "payment_method_id": self.tokens.payment_method_id,
            "user_id": self.tokens.user_id,
            "token_expiry": self.tokens.token_expiry,
            "saved_at": time.time(),
        }
        Path(path).write_text(json.dumps(data, indent=2))

    @classmethod
    def from_saved_tokens(cls, path: str) -> "ResyClient":
        """Load client from saved tokens."""
        data = json.loads(Path(path).read_text())
        tokens = ResyTokens(
            api_key=data.get("api_key", DEFAULT_API_KEY),
            auth_token=data.get("auth_token"),
            refresh_token=data.get("refresh_token"),
            payment_method_id=data.get("payment_method_id"),
            user_id=data.get("user_id"),
            token_expiry=data.get("token_expiry"),
        )
        return cls(tokens=tokens)

    async def close(self):
        await self.http.aclose()


def pick_best_slot(slots: list[dict], preferred_time: str | None = None) -> dict:
    """Pick the best slot from available options, matching preferred time if given."""
    if not slots:
        raise ValueError("No slots available")

    if not preferred_time:
        return slots[0]

    # Parse preferred time (e.g., "19:30", "7:30 PM")
    target_minutes = _parse_time_to_minutes(preferred_time)
    if target_minutes is None:
        return slots[0]

    best = slots[0]
    best_diff = float("inf")

    for slot in slots:
        slot_time = slot.get("date", {}).get("start", "")
        # Resy slot times are like "2026-03-28 19:30:00"
        if " " in slot_time:
            time_part = slot_time.split(" ")[1][:5]  # "19:30"
        else:
            time_part = slot_time[:5]

        slot_minutes = _parse_time_to_minutes(time_part)
        if slot_minutes is not None:
            diff = abs(slot_minutes - target_minutes)
            if diff < best_diff:
                best_diff = diff
                best = slot

    return best


def _parse_time_to_minutes(time_str: str) -> int | None:
    """Parse a time string to minutes since midnight."""
    import re
    # Handle "19:30", "7:30 PM", "7:30PM"
    match = re.match(r"(\d{1,2}):(\d{2})\s*(am|pm)?", time_str.strip(), re.IGNORECASE)
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2))
    ampm = (match.group(3) or "").lower()
    if ampm == "pm" and hour < 12:
        hour += 12
    if ampm == "am" and hour == 12:
        hour = 0
    return hour * 60 + minute


def get_resy_token_path(user_id: str) -> str:
    """Get the path where Resy tokens are stored for a user."""
    return f"profiles/{user_id}/resy_tokens.json"


def has_resy_tokens(user_id: str) -> bool:
    """Check if a user has saved Resy tokens."""
    return Path(get_resy_token_path(user_id)).exists()


def are_resy_tokens_valid(user_id: str) -> bool:
    """Check if tokens exist and haven't expired."""
    path = get_resy_token_path(user_id)
    if not Path(path).exists():
        return False
    try:
        data = json.loads(Path(path).read_text())
        expiry = data.get("token_expiry", 0)
        return expiry > time.time()
    except Exception:
        return False


async def book_resy_reservation(
    user_id: str,
    restaurant_name: str | None = None,
    venue_id: int | None = None,
    date: str = "",
    party_size: int = 2,
    preferred_time: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    email: str | None = None,
    password: str | None = None,
) -> dict:
    """
    Complete Resy booking flow — ~2 seconds total, no browser.

    1. Load cached token (or login with email/password)
    2. Search for venue (if venue_id not provided)
    3. Get available slots for the date
    4. Pick the best slot (matching preferred time)
    5. Get slot details (booking token)
    6. Book it
    """
    client = None
    try:
        # Step 1: Auth — try cached tokens first
        token_path = get_resy_token_path(user_id)
        if are_resy_tokens_valid(user_id):
            client = ResyClient.from_saved_tokens(token_path)
            print(f"[resy] Loaded cached tokens for user {user_id}")
        elif email and password:
            client = ResyClient()
            await client.login(email, password)
            client.save_tokens(token_path)
            print(f"[resy] Logged in as {email}")
        else:
            return {
                "status": "LOGIN_REQUIRED",
                "message": "Resy account not linked. Please provide your Resy email and password.",
                "platform": "resy",
            }

        # Step 2: Find venue
        if not venue_id and restaurant_name:
            venues = await client.search_venues(
                query=restaurant_name,
                lat=lat,
                lng=lng,
                date=date or None,
                party_size=party_size,
            )
            if not venues:
                return {
                    "status": "NO_AVAILABILITY",
                    "message": f"No Resy restaurants found for '{restaurant_name}'",
                }
            # Extract venue_id — handle both response formats
            hit = venues[0]
            # New format: { "id": { "resy": 123 }, "name": "..." }
            if "id" in hit and isinstance(hit["id"], dict):
                venue_id = hit["id"].get("resy")
                venue_name = hit.get("name", restaurant_name)
            # Old format: { "venue": { "id": { "resy": 123 }, "name": "..." } }
            elif "venue" in hit:
                venue_id = hit["venue"].get("id", {}).get("resy")
                venue_name = hit["venue"].get("name", restaurant_name)
            else:
                venue_id = hit.get("id")
                venue_name = hit.get("name", restaurant_name)
            print(f"[resy] Found venue: {venue_name} (id={venue_id})")

        if not venue_id:
            return {"status": "ERROR", "message": "No venue_id and no restaurant name to search"}

        # Step 3: Get available slots
        slots = await client.get_slots(venue_id, date, party_size)
        if not slots:
            return {
                "status": "NO_AVAILABILITY",
                "message": f"No tables available for {party_size} on {date}",
                "venue_id": venue_id,
            }

        print(f"[resy] Found {len(slots)} available slots")

        # Step 4: Pick best slot
        slot = pick_best_slot(slots, preferred_time)
        slot_time = slot.get("date", {}).get("start", "unknown")
        slot_type = slot.get("config", {}).get("type", "")
        print(f"[resy] Selected slot: {slot_time} ({slot_type})")

        # Step 5: Get details + booking token
        config_token = slot.get("config", {}).get("token")
        if not config_token:
            return {"status": "ERROR", "message": "Slot missing config token"}

        details = await client.get_slot_details(config_token, date, party_size)
        book_token = details.get("book_token", {}).get("value")

        if not book_token:
            # May require payment method — check if cancellation fee exists
            cancellation = details.get("cancellation", {})
            if cancellation.get("fee"):
                return {
                    "status": "PAYMENT_REQUIRED",
                    "message": f"This reservation requires a cancellation fee deposit of {cancellation.get('fee', {}).get('amount', 'unknown')}",
                    "venue_id": venue_id,
                    "slot_time": slot_time,
                }
            return {"status": "ERROR", "message": "Could not get booking token"}

        # Step 6: Book
        confirmation = await client.book_reservation(book_token)

        # Extract confirmation details
        resy_token = confirmation.get("resy_token", "")
        conf_number = confirmation.get("reservation_id", "")

        return {
            "status": "RESERVATION_CONFIRMED",
            "message": f"Reservation confirmed at {restaurant_name or 'restaurant'}",
            "confirmation_code": str(conf_number),
            "resy_token": resy_token,
            "restaurant": restaurant_name,
            "venue_id": venue_id,
            "date": date,
            "time": slot_time,
            "party_size": party_size,
            "booking_method": "api:resy",
        }

    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code
        if status_code in (401, 419):
            # Token expired — clear cached tokens
            try:
                Path(get_resy_token_path(user_id)).unlink(missing_ok=True)
            except Exception:
                pass
            return {
                "status": "LOGIN_REQUIRED",
                "message": "Resy session expired. Please re-link your Resy account.",
                "platform": "resy",
            }
        elif status_code == 402:
            return {
                "status": "PAYMENT_REQUIRED",
                "message": "This reservation requires payment or a credit card on file.",
            }
        elif status_code == 412:
            return {
                "status": "NO_AVAILABILITY",
                "message": "This time slot is no longer available.",
            }
        else:
            return {"status": "ERROR", "message": f"Resy API error {status_code}: {str(e)[:200]}"}

    except Exception as e:
        return {"status": "ERROR", "message": f"Resy booking failed: {str(e)[:200]}"}

    finally:
        if client:
            await client.close()
