import asyncio
import os
from browser_use.agent.service import Agent
from browser_use.browser.profile import BrowserProfile
from browser_use.browser.session import BrowserSession
from browser_use.llm.openai.chat import ChatOpenAI
from job_store import store

BROWSER_HEADLESS = os.getenv("BROWSER_HEADLESS", "true").lower() == "true"
BOOKING_TIMEOUT = int(os.getenv("FITNESS_BOOKING_TIMEOUT", "120"))


def build_fitness_task_prompt(class_data: dict, user_info: dict) -> str:
    studio_website = class_data.get("studioWebsite", "") or class_data.get("bookingUrl", "")
    class_name = class_data.get("className", "")
    instructor = class_data.get("instructor", "")
    class_date = class_data.get("date", "")
    class_time = class_data.get("time", "")
    studio_name = class_data.get("studioName", "")

    first_name = user_info.get("firstName", "")
    last_name = user_info.get("lastName", "")
    email = user_info.get("email", "")
    phone = user_info.get("phone", "")
    use_google_login = user_info.get("useGoogleLogin", False)

    google_login_instructions = ""
    if use_google_login:
        google_login_instructions = f"""
GOOGLE LOGIN INSTRUCTIONS:
- Look for a "Sign in with Google" or "Continue with Google" or "Google" button
- If you find one, click it to log in using the Google account for {email}
- If a Google login popup appears, select the account matching {email}
- If no Google login option exists, use the regular login/registration form instead
- If the site requires account creation, create one with the details below
"""

    return f"""Go to this fitness studio website: {studio_website}

Your goal: Book the class "{class_name}" at {studio_name}.
Class details:
- Instructor: {instructor}
- Date: {class_date}
- Time: {class_time}

Step-by-step:
1. Navigate to the studio website
2. Look for a class schedule, "Book a Class", "Schedule", or "Classes" section
{google_login_instructions}
3. Find the class "{class_name}" scheduled for {class_date} at {class_time}
4. Click "Book", "Register", "Sign Up", or similar button for that class
5. If a registration/booking form appears, fill in:
   - First name: {first_name}
   - Last name: {last_name}
   - Email: {email}
   {f'- Phone: {phone}' if phone else ''}
6. Submit the booking form

CRITICAL SAFETY RULES:
- Do NOT enter any credit card or payment information
- Do NOT click "Pay", "Buy Now", "Purchase", or "Checkout" buttons
- If the class requires payment, STOP and report "PAYMENT_REQUIRED"
- If you see a Stripe, PayPal, Square, or any payment form, STOP immediately
- At each step, describe what you see on the page

Report your final status as one of:
- "CLASS_BOOKED" — if you successfully registered/booked the class
- "PAYMENT_REQUIRED" — if the site requires payment to complete booking
- "ALREADY_REGISTERED" — if the account is already registered for this class
- "CLASS_FULL" — if the class is full or has no spots available
- "BLOCKED" — if the site blocked automation or required CAPTCHA
- "LOGIN_REQUIRED" — if login was required but could not be completed
- "ERROR" — if something went wrong

Include any confirmation numbers, booking references, or confirmation messages in your report."""


async def run_fitness_booking(job_id: str, class_data: dict, user_info: dict) -> None:
    """Run the browser-use booking agent for a fitness class."""
    session = None
    try:
        await store.update_status(job_id, "navigating", "Opening studio website...")

        profile = BrowserProfile(headless=BROWSER_HEADLESS)
        session = BrowserSession(browser_profile=profile)
        llm = ChatOpenAI(model="gpt-4o", temperature=0)

        task = build_fitness_task_prompt(class_data, user_info)

        agent = Agent(
            task=task,
            llm=llm,
            browser_session=session,
        )

        await store.update_status(job_id, "finding_class", "Searching for your class...")

        result = await asyncio.wait_for(
            agent.run(),
            timeout=BOOKING_TIMEOUT,
        )

        final_text = result.final_result() if result else "No result returned"

        await store.update_status(job_id, "processing", "Processing results...")

        final_str = str(final_text)

        if "CLASS_BOOKED" in final_str:
            await store.set_result(job_id, {
                "status": "booked",
                "message": final_str,
                "studioWebsite": class_data.get("studioWebsite", ""),
            })
        elif "ALREADY_REGISTERED" in final_str:
            await store.set_result(job_id, {
                "status": "already_registered",
                "message": final_str,
                "studioWebsite": class_data.get("studioWebsite", ""),
            })
        elif "PAYMENT_REQUIRED" in final_str:
            await store.set_result(job_id, {
                "status": "payment_required",
                "message": final_str,
                "studioWebsite": class_data.get("studioWebsite", ""),
            })
        elif "CLASS_FULL" in final_str:
            await store.set_error(job_id, "This class is full. Try a different time or check for waitlist options.")
        elif "BLOCKED" in final_str:
            await store.set_error(job_id, f"The studio website blocked automation. Please book manually: {class_data.get('studioWebsite', '')}")
        elif "LOGIN_REQUIRED" in final_str:
            await store.set_error(job_id, f"Login was required but could not be completed. Please book manually: {class_data.get('studioWebsite', '')}")
        else:
            await store.set_result(job_id, {
                "status": "unknown",
                "message": final_str,
                "studioWebsite": class_data.get("studioWebsite", ""),
            })

    except asyncio.TimeoutError:
        await store.set_error(job_id, f"Booking timed out after {BOOKING_TIMEOUT} seconds. Please try booking manually.")
    except Exception as e:
        await store.set_error(job_id, f"Booking failed: {str(e)}")
    finally:
        try:
            if session:
                await session.close()
        except Exception:
            pass
