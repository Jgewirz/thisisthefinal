import uuid
import asyncio
import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from job_store import store
from flight_booker import run_booking
from fitness_booker import run_fitness_booking
from lifestyle_booker import run_lifestyle_booking
from browser_profiles import has_profile, open_real_chrome_for_signin, verify_cookies_saved
from site_memory import list_profiles, get_profile_detail
from auth_session import (
    load_user_session, save_user_session, check_session_health,
    do_manual_signin, UserAuthSession, get_profile_path,
)

app = FastAPI(title="Booking Agent", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════════
# Shared models
# ═══════════════════════════════════════════════════════════════════════

class BookResponse(BaseModel):
    jobId: str
    status: str


# ═══════════════════════════════════════════════════════════════════════
# Browser profile management — persistent Google login per user
# ═══════════════════════════════════════════════════════════════════════

class SetupBrowserRequest(BaseModel):
    userId: str
    email: str


@app.post("/setup-browser")
async def setup_browser(req: SetupBrowserRequest):
    """Save user session info. Sign-in happens via --signin CLI (real Chrome, no automation)."""
    import time
    existing = load_user_session(req.userId)
    session = existing or UserAuthSession(user_id=req.userId, google_email=req.email)
    session.google_email = req.email
    save_user_session(session)
    return {
        "success": True,
        "message": f"Session saved. Use --signin CLI to open real Chrome for sign-in.",
    }


@app.get("/browser-profile/{user_id}")
async def check_browser_profile(user_id: str):
    """Check if a user has a browser profile with a saved session."""
    session = load_user_session(user_id)
    auth_status = check_session_health(user_id)
    return {
        "userId": user_id,
        "hasProfile": has_profile(user_id),
        "authStatus": auth_status,
        "googleEmail": session.google_email if session else None,
        "studioSessions": session.studio_sessions if session else {},
    }


class ManualLoginRequest(BaseModel):
    userId: str
    loginUrl: str
    domain: str
    studioName: str = ""


@app.post("/manual-login")
async def manual_login(req: ManualLoginRequest):
    """Open real Chrome for the user to sign into a studio website. No automation flags."""
    result = do_manual_signin(
        req.userId, req.studioName, req.loginUrl, req.domain,
    )
    return result


@app.get("/auth-status/{user_id}")
async def get_auth_status(user_id: str):
    """Check the auth session status for a user, optionally for a specific domain."""
    from fastapi import Query
    session = load_user_session(user_id)
    if not session:
        return {"userId": user_id, "status": "never_logged_in", "session": None}
    return {
        "userId": user_id,
        "status": check_session_health(user_id),
        "session": {
            "googleEmail": session.google_email,
            "googleName": session.google_name,
            "googleSessionSeeded": session.google_session_seeded,
            "lastSessionSeed": session.last_session_seed,
            "studioSessions": session.studio_sessions,
        },
    }


# ═══════════════════════════════════════════════════════════════════════
# Flight booking
# ═══════════════════════════════════════════════════════════════════════

class PassengerInfo(BaseModel):
    firstName: str
    lastName: str
    email: str
    phone: str | None = None


class BookRequest(BaseModel):
    flightData: dict
    passengerInfo: PassengerInfo


@app.post("/book", response_model=BookResponse)
async def book_flight(req: BookRequest):
    job_id = str(uuid.uuid4())
    await store.create(job_id, req.flightData, req.passengerInfo.model_dump(), job_type="flight")
    asyncio.create_task(run_booking(job_id, req.flightData, req.passengerInfo.model_dump()))
    return BookResponse(jobId=job_id, status="queued")


# ═══════════════════════════════════════════════════════════════════════
# Fitness class booking
# ═══════════════════════════════════════════════════════════════════════

class FitnessUserInfo(BaseModel):
    firstName: str
    lastName: str
    email: str
    phone: str | None = None
    useGoogleLogin: bool = False
    userId: str | None = None  # For persistent browser profile lookup


class FitnessBookRequest(BaseModel):
    classData: dict
    userInfo: FitnessUserInfo
    knownSteps: list | None = None


@app.post("/book-fitness", response_model=BookResponse)
async def book_fitness_class(req: FitnessBookRequest):
    job_id = str(uuid.uuid4())
    await store.create(job_id, req.classData, req.userInfo.model_dump(), job_type="fitness")
    asyncio.create_task(run_fitness_booking(
        job_id, req.classData, req.userInfo.model_dump(), known_steps=req.knownSteps
    ))
    return BookResponse(jobId=job_id, status="queued")


# ═══════════════════════════════════════════════════════════════════════
# Lifestyle booking (restaurants, salons, spas, nails)
# ═══════════════════════════════════════════════════════════════════════

class LinkResyRequest(BaseModel):
    userId: str
    email: str
    password: str


@app.post("/link-resy")
async def link_resy(req: LinkResyRequest):
    """Authenticate with Resy and save tokens for a user."""
    from api_clients.resy_client import ResyClient, get_resy_token_path
    import httpx

    client = ResyClient()
    try:
        user_data = await client.login(req.email, req.password)
    except httpx.HTTPStatusError as e:
        if e.response.status_code in (401, 419):
            return {"success": False, "error": "Invalid Resy email or password"}
        raise
    finally:
        await client.close()

    # Still save to file for CLI/fallback
    token_path = get_resy_token_path(req.userId)
    client_for_save = ResyClient(tokens=client.tokens)
    client_for_save.save_tokens(token_path)
    await client_for_save.close()

    first_name = user_data.get("first_name", "")
    last_name = user_data.get("last_name", "")
    return {
        "success": True,
        "message": f"Resy account linked for {req.email}",
        "userName": f"{first_name} {last_name}".strip(),
        "hasPaymentMethod": client.tokens.payment_method_id is not None,
        # Return tokens so Express can store in DB
        "authToken": client.tokens.auth_token,
        "resyUserId": client.tokens.user_id,
        "paymentMethodId": client.tokens.payment_method_id,
    }


@app.get("/resy-status/{user_id}")
async def resy_status(user_id: str):
    """Check if a user has linked Resy credentials."""
    from api_clients.resy_client import has_resy_tokens, are_resy_tokens_valid
    return {
        "userId": user_id,
        "hasTokens": has_resy_tokens(user_id),
        "isValid": are_resy_tokens_valid(user_id),
    }


# ─── Resy restaurant search (location-aware) ─────────────────────────

class RestaurantSearchRequest(BaseModel):
    user_id: str
    query: str | None = None
    date: str | None = None
    party_size: int = 2
    time_preference: str | None = None
    user_lat: float | None = None
    user_lng: float | None = None
    user_location: str | None = None
    # Tokens passed from Express (DB-backed)
    resy_auth_token: str | None = None
    resy_payment_method_id: str | None = None
    resy_user_id: str | None = None


@app.post("/search-restaurants")
async def search_restaurants(req: RestaurantSearchRequest):
    """Search Resy for restaurants near the user's location."""
    from api_clients.resy_client import ResyClient, ResyTokens

    # Build client from passed tokens or fall back to file-based tokens
    client = None
    try:
        if req.resy_auth_token:
            tokens = ResyTokens(
                auth_token=req.resy_auth_token,
                payment_method_id=int(req.resy_payment_method_id) if req.resy_payment_method_id else None,
                user_id=int(req.resy_user_id) if req.resy_user_id else None,
            )
            client = ResyClient(tokens=tokens)
        else:
            # No auth — search is still possible (unauthenticated)
            client = ResyClient()

        venues = await client.search_venues(
            query=req.query or "restaurants",
            lat=req.user_lat,
            lng=req.user_lng,
            date=req.date,
            party_size=req.party_size,
        )

        # For each venue, get time slots if date provided and user is authenticated
        results = []
        for hit in venues[:8]:
            # Handle both response formats
            venue = hit.get("venue", hit)
            venue_id_obj = venue.get("id", {})
            venue_id = venue_id_obj.get("resy") if isinstance(venue_id_obj, dict) else venue_id_obj
            if not venue_id:
                continue

            location = venue.get("location", {})
            images = venue.get("images", [])
            image_url = None
            if images:
                image_url = images[0] if isinstance(images[0], str) else images[0].get("url")

            slots = []
            if req.date and client.is_authenticated:
                try:
                    raw_slots = await client.get_slots(venue_id, req.date, req.party_size)
                    for s in raw_slots[:10]:
                        slot_time = s.get("date", {}).get("start", "")
                        slot_type = s.get("config", {}).get("type", "")
                        config_token = s.get("config", {}).get("token", "")
                        if config_token:
                            slots.append({
                                "time": slot_time,
                                "type": slot_type,
                                "configToken": config_token,
                            })
                except Exception as e:
                    print(f"[search] Failed to get slots for venue {venue_id}: {e}")

            # Extract rating — Resy returns {"average": 5.0, "count": 0} or a flat number
            raw_rating = venue.get("rating")
            if isinstance(raw_rating, dict):
                rating_avg = raw_rating.get("average")
                rating_count = raw_rating.get("count", 0)
            else:
                rating_avg = raw_rating
                rating_count = None

            # Price range: Resy uses price_range_id (1-4) → $-$$$$
            price_range_id = venue.get("price_range_id") or venue.get("price_range")
            price_display = None
            if price_range_id and isinstance(price_range_id, int):
                price_display = "$" * price_range_id

            # Contact info
            contact = venue.get("contact", {})
            phone = contact.get("phone_number") if isinstance(contact, dict) else None

            # Geolocation
            geoloc = venue.get("_geoloc", {})

            results.append({
                "venueId": venue_id,
                "name": venue.get("name", ""),
                "cuisine": venue.get("cuisine", []),
                "neighborhood": location.get("neighborhood", "") or venue.get("neighborhood", ""),
                "rating": rating_avg,
                "reviewCount": rating_count,
                "priceRange": price_range_id,
                "priceDisplay": price_display,
                "imageUrl": image_url,
                "address": location.get("address_1", ""),
                "city": location.get("city", "") or venue.get("locality", ""),
                "region": location.get("region", "") or venue.get("region", ""),
                "phone": phone,
                "maxPartySize": venue.get("max_party_size"),
                "resyUrl": f"https://resy.com/cities/{location.get('code', '')}/{venue.get('url_slug', '')}" if venue.get("url_slug") else None,
                "lat": geoloc.get("lat"),
                "lng": geoloc.get("lng"),
                "slots": slots,
                "hasAvailability": len(slots) > 0,
            })

        return {
            "status": "OK",
            "restaurants": results,
            "location": req.user_location,
            "hasAuth": client.is_authenticated,
        }

    except Exception as e:
        print(f"[search-restaurants] Error: {e}")
        return {"status": "ERROR", "message": str(e)[:200], "restaurants": []}
    finally:
        if client:
            await client.close()


# ─── Resy instant booking (no browser) ───────────────────────────────

class ResyBookRequest(BaseModel):
    user_id: str
    venue_id: int
    config_token: str
    date: str
    party_size: int = 2
    # Tokens passed from Express
    resy_auth_token: str
    resy_payment_method_id: str | None = None
    resy_user_id: str | None = None


@app.post("/book-resy")
async def book_resy(req: ResyBookRequest):
    """Book a specific Resy slot instantly via API."""
    from api_clients.resy_client import ResyClient, ResyTokens
    import httpx

    tokens = ResyTokens(
        auth_token=req.resy_auth_token,
        payment_method_id=int(req.resy_payment_method_id) if req.resy_payment_method_id else None,
        user_id=int(req.resy_user_id) if req.resy_user_id else None,
    )
    client = ResyClient(tokens=tokens)

    try:
        # Get slot details + booking token
        details = await client.get_slot_details(req.config_token, req.date, req.party_size)
        book_token = details.get("book_token", {}).get("value")

        if not book_token:
            cancellation = details.get("cancellation", {})
            if cancellation.get("fee"):
                return {
                    "status": "PAYMENT_REQUIRED",
                    "message": f"This reservation requires a deposit of {cancellation.get('fee', {}).get('amount', 'unknown')}",
                }
            return {"status": "ERROR", "message": "Could not get booking token — slot may be unavailable"}

        # Book it
        confirmation = await client.book_reservation(book_token)

        return {
            "status": "BOOKED",
            "confirmation_id": str(confirmation.get("resy_token", "")),
            "reservation_id": str(confirmation.get("reservation_id", "")),
            "restaurant": details.get("venue", {}).get("name", ""),
            "date": req.date,
            "time": details.get("config", {}).get("time_slot", ""),
            "party_size": req.party_size,
            "seating_type": details.get("config", {}).get("type", ""),
        }

    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        if code in (401, 419):
            return {"status": "LOGIN_REQUIRED", "message": "Resy session expired. Please re-link your account."}
        elif code == 412:
            return {"status": "NO_AVAILABILITY", "message": "This time slot was just taken. Try another time."}
        elif code == 402:
            return {"status": "PAYMENT_REQUIRED", "message": "A credit card is required for this reservation."}
        return {"status": "ERROR", "message": f"Resy API error {code}: {str(e)[:200]}"}
    except Exception as e:
        return {"status": "ERROR", "message": f"Booking failed: {str(e)[:200]}"}
    finally:
        await client.close()


class LinkHatchRequest(BaseModel):
    userId: str
    email: str
    password: str


class HatchControlRequest(BaseModel):
    userId: str
    deviceId: str | None = None  # null = first/only device
    action: str  # "set_sound", "set_volume", "set_color", "turn_off", "turn_on", "set_brightness"
    params: dict = {}  # { sound: "ocean", volume: 50, brightness: 30, r: 255, g: 100, b: 50 }


@app.post("/link-hatch")
async def link_hatch(req: LinkHatchRequest):
    """Authenticate with Hatch, discover devices, save credentials."""
    from api_clients.hatch_client import connect_and_get_devices, save_hatch_session

    try:
        devices = await connect_and_get_devices(req.email, req.password)
        save_hatch_session(req.userId, req.email, req.password, devices)
        return {
            "success": True,
            "message": f"Hatch account linked. Found {len(devices)} device(s).",
            "deviceCount": len(devices),
            "devices": devices,
        }
    except Exception as e:
        error_msg = str(e)
        if "NotAuthorizedException" in error_msg or "UserNotFoundException" in error_msg:
            return {"success": False, "error": "Invalid Hatch email or password"}
        return {"success": False, "error": f"Failed to connect: {error_msg[:200]}"}


@app.get("/hatch-devices/{user_id}")
async def hatch_devices(user_id: str):
    """List user's Hatch devices (re-discovers from API)."""
    from api_clients.hatch_client import load_hatch_session, connect_and_get_devices, save_hatch_session

    session = load_hatch_session(user_id)
    if not session:
        return {"userId": user_id, "hasSession": False, "devices": []}

    try:
        devices = await connect_and_get_devices(session["email"], session["password"])
        save_hatch_session(user_id, session["email"], session["password"], devices)
        return {"userId": user_id, "hasSession": True, "devices": devices}
    except Exception as e:
        # Return cached devices if live query fails
        return {
            "userId": user_id,
            "hasSession": True,
            "devices": session.get("devices", []),
            "error": f"Live query failed: {str(e)[:200]}",
        }


@app.post("/hatch-control")
async def hatch_control(req: HatchControlRequest):
    """Execute a control command on a user's Hatch device."""
    from api_clients.hatch_client import load_hatch_session, control_device

    session = load_hatch_session(req.userId)
    if not session:
        return {"success": False, "error": "Hatch account not linked. Please link your account first.", "needsLink": True}

    result = await control_device(
        email=session["email"],
        password=session["password"],
        device_id=req.deviceId,
        action=req.action,
        params=req.params,
    )
    return result


class LifestyleBookRequest(BaseModel):
    bookingData: dict
    userInfo: dict
    knownSteps: list | None = None


@app.post("/book-lifestyle", response_model=BookResponse)
async def book_lifestyle(req: LifestyleBookRequest):
    job_id = str(uuid.uuid4())
    await store.create(job_id, req.bookingData, req.userInfo, job_type="lifestyle")
    asyncio.create_task(run_lifestyle_booking(
        job_id, req.bookingData, req.userInfo, known_steps=req.knownSteps
    ))
    return BookResponse(jobId=job_id, status="queued")


# ═══════════════════════════════════════════════════════════════════════
# Shared status endpoint
# ═══════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"status": "ok", "service": "booking-agent", "capabilities": ["flight", "fitness", "lifestyle", "hatch", "browser-profiles"]}


@app.get("/status/{job_id}")
async def get_status(job_id: str):
    job = await store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "jobId": job["jobId"],
        "jobType": job.get("jobType", "flight"),
        "status": job["status"],
        "steps": job["steps"],
        "currentStep": job["currentStep"],
        "result": job["result"],
        "error": job["error"],
    }


# ═══════════════════════════════════════════════════════════════════════
# Site profile debug endpoints
# ═══════════════════════════════════════════════════════════════════════

@app.get("/site-profiles")
async def get_site_profiles():
    """List all learned site profiles with summary info."""
    return {"profiles": list_profiles()}


@app.get("/site-profiles/{domain}")
async def get_site_profile(domain: str):
    """Get full profile for a domain."""
    profile = get_profile_detail(domain)
    if not profile:
        raise HTTPException(status_code=404, detail=f"No profile found for {domain}")
    return profile


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BOOKING_AGENT_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
