import asyncio
import os
from browser_use.agent.service import Agent
from browser_use.browser.profile import BrowserProfile
from browser_use.browser.session import BrowserSession
from browser_use.llm.openai.chat import ChatOpenAI
from job_store import store
from browser_utils import (
    kill_stale_browsers, find_available_debug_port, set_browser_launch_timeout,
)

# Set browser startup timeout before browser-use reads it
set_browser_launch_timeout(int(os.getenv("BROWSER_STARTUP_TIMEOUT", "90")))

BROWSER_HEADLESS = os.getenv("BROWSER_HEADLESS", "true").lower() == "true"
BOOKING_TIMEOUT = int(os.getenv("FLIGHT_BOOKING_TIMEOUT", "90"))


def build_task_prompt(flight_data: dict, passenger_info: dict) -> str:
    booking_url = flight_data.get("bookingUrl", "")
    airline = flight_data.get("airline", "Unknown Airline")
    flight_number = flight_data.get("flightNumber", "")
    departure = flight_data.get("departure", {})
    arrival = flight_data.get("arrival", {})
    departure_date = flight_data.get("departureDate", "")
    price = flight_data.get("price", "")

    first_name = passenger_info.get("firstName", "")
    last_name = passenger_info.get("lastName", "")
    email = passenger_info.get("email", "")
    phone = passenger_info.get("phone", "")

    return f"""Go to this Google Flights booking URL: {booking_url}

Find and select the {airline} flight {flight_number} departing at {departure.get('time', '')} on {departure_date} from {departure.get('city', '')} to {arrival.get('city', '')}, priced at {price}.

Once you've selected the correct flight:
1. Click through to the airline's booking page
2. Fill in passenger details:
   - First name: {first_name}
   - Last name: {last_name}
   - Email: {email}
   {f'- Phone: {phone}' if phone else ''}

IMPORTANT RULES:
- Do NOT enter any payment or credit card information
- Stop at the payment/checkout page
- If asked for payment, stop and report what you see
- Report the confirmation page URL if you reach one
- If Google Pay one-click is available, note it but do NOT click it
- At each step, describe what you see on the page

Report your final status as one of:
- "REACHED_PAYMENT" - if you made it to the payment page
- "BOOKING_COMPLETE" - if booking completed (e.g., free rebooking)
- "BLOCKED" - if the site blocked automation or required CAPTCHA
- "ERROR" - if something went wrong

Include any confirmation codes, booking references, or final page URLs in your report."""


async def run_booking(job_id: str, flight_data: dict, passenger_info: dict) -> None:
    """Run the browser-use booking agent for a given job."""
    session = None
    try:
        await store.update_status(job_id, "navigating", "Opening Google Flights...")

        debug_port = find_available_debug_port()
        profile = BrowserProfile(
            headless=BROWSER_HEADLESS,
            args=[f"--remote-debugging-port={debug_port}"],
        )
        session = BrowserSession(browser_profile=profile)
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        task = build_task_prompt(flight_data, passenger_info)

        agent = Agent(
            task=task,
            llm=llm,
            browser_session=session,
        )

        await store.update_status(job_id, "selecting_flight", "Finding your flight...")

        # Run with timeout
        result = await asyncio.wait_for(
            agent.run(),
            timeout=BOOKING_TIMEOUT,
        )

        # Parse the final result
        final_text = result.final_result() if result else "No result returned"

        await store.update_status(job_id, "confirming", "Processing results...")

        if "BOOKING_COMPLETE" in str(final_text):
            await store.set_result(job_id, {
                "status": "completed",
                "message": str(final_text),
                "bookingUrl": flight_data.get("bookingUrl", ""),
            })
        elif "REACHED_PAYMENT" in str(final_text):
            await store.set_result(job_id, {
                "status": "awaiting_payment",
                "message": str(final_text),
                "bookingUrl": flight_data.get("bookingUrl", ""),
            })
        elif "BLOCKED" in str(final_text):
            await store.set_error(job_id, f"Booking was blocked by the website. Please book manually: {flight_data.get('bookingUrl', '')}")
        else:
            await store.set_result(job_id, {
                "status": "unknown",
                "message": str(final_text),
                "bookingUrl": flight_data.get("bookingUrl", ""),
            })

    except asyncio.TimeoutError:
        await store.set_error(job_id, "Booking timed out after 90 seconds. Please try booking manually.")
    except Exception as e:
        await store.set_error(job_id, f"Booking failed: {str(e)}")
    finally:
        try:
            if session:
                await session.close()
        except Exception:
            pass
