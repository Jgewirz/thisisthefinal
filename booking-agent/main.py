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
# Flight booking (existing)
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
# Fitness class booking (new)
# ═══════════════════════════════════════════════════════════════════════

class FitnessUserInfo(BaseModel):
    firstName: str
    lastName: str
    email: str
    phone: str | None = None
    useGoogleLogin: bool = False


class FitnessBookRequest(BaseModel):
    classData: dict
    userInfo: FitnessUserInfo


@app.post("/book-fitness", response_model=BookResponse)
async def book_fitness_class(req: FitnessBookRequest):
    job_id = str(uuid.uuid4())
    await store.create(job_id, req.classData, req.userInfo.model_dump(), job_type="fitness")
    asyncio.create_task(run_fitness_booking(job_id, req.classData, req.userInfo.model_dump()))
    return BookResponse(jobId=job_id, status="queued")


# ═══════════════════════════════════════════════════════════════════════
# Shared status endpoint (works for both flight & fitness)
# ═══════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"status": "ok", "service": "booking-agent", "capabilities": ["flight", "fitness"]}


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


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("BOOKING_AGENT_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
