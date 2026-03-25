"""
Platform router — picks the fastest path for each booking.

Direct API (instant):  Resy (~2 seconds)
Browser automation:    Everything else (OpenTable, Vagaro, Booksy, SoulCycle, etc.)
"""

from site_memory import extract_domain


DIRECT_API_PLATFORMS = {
    "resy.com": "resy",
    # Future:
    # "booksy.com": "booksy",
    # "mindbodyonline.com": "mindbody",
    # "squareup.com": "square",
}


def get_booking_method(url_or_domain: str) -> str:
    """
    Determine the best booking method for a URL or domain.
    Returns: "api:resy", "browser", etc.
    """
    # Extract domain from URL if needed
    if "/" in url_or_domain:
        domain = extract_domain(url_or_domain)
    else:
        domain = url_or_domain

    domain_clean = domain.lower().replace("www.", "")

    if domain_clean in DIRECT_API_PLATFORMS:
        return f"api:{DIRECT_API_PLATFORMS[domain_clean]}"

    return "browser"


def is_api_available(url_or_domain: str) -> bool:
    """Check if a direct API client exists for this domain."""
    return get_booking_method(url_or_domain).startswith("api:")


def get_platform_name(url_or_domain: str) -> str | None:
    """Get the platform name for API routing, or None for browser."""
    method = get_booking_method(url_or_domain)
    if method.startswith("api:"):
        return method.split(":", 1)[1]
    return None


async def route_lifestyle_booking(
    booking_data: dict,
    user_info: dict,
    job_id: str,
    known_steps: list | None = None,
) -> dict | None:
    """
    Try direct API booking first. Returns result dict if API handled it,
    or None if browser automation should be used.
    """
    venue_url = booking_data.get("venueWebsite", "") or booking_data.get("bookingUrl", "")
    if not venue_url:
        return None

    method = get_booking_method(venue_url)
    user_id = user_info.get("userId", "")

    if method == "api:resy":
        from api_clients.resy_client import book_resy_reservation, has_resy_tokens

        # Only use API if user has linked their Resy account
        if not has_resy_tokens(user_id):
            print(f"[router] Resy API available but user {user_id} has no tokens — falling back to browser")
            return None

        print(f"[router] Routing to Resy API (direct, ~2s)")

        result = await book_resy_reservation(
            user_id=user_id,
            restaurant_name=booking_data.get("venueName"),
            date=booking_data.get("date", ""),
            party_size=booking_data.get("partySize", 2),
            preferred_time=booking_data.get("time"),
        )

        return result

    # No API available — caller should use browser automation
    return None
