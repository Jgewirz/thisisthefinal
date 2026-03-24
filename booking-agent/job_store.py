import asyncio
import time
from typing import Any


class JobStore:
    def __init__(self, ttl_seconds: int = 1800):
        self._jobs: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock()
        self._ttl = ttl_seconds

    async def create(self, job_id: str, booking_data: dict, user_info: dict, job_type: str = "flight") -> dict:
        async with self._lock:
            job = {
                "jobId": job_id,
                "jobType": job_type,
                "status": "queued",
                "steps": [],
                "currentStep": None,
                "result": None,
                "error": None,
                "bookingData": booking_data,
                "userInfo": user_info,
                # Keep backward-compat aliases for flight bookings
                "flightData": booking_data if job_type == "flight" else None,
                "passengerInfo": user_info if job_type == "flight" else None,
                "createdAt": time.time(),
            }
            self._jobs[job_id] = job
            return job

    async def get(self, job_id: str) -> dict | None:
        async with self._lock:
            self._cleanup_expired()
            return self._jobs.get(job_id)

    async def update_status(self, job_id: str, status: str, step: str | None = None) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job["status"] = status
            if step:
                job["currentStep"] = step
                job["steps"].append({"step": step, "status": status, "timestamp": time.time()})

    async def set_result(self, job_id: str, result: dict) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job["status"] = "completed"
            job["result"] = result
            job["currentStep"] = "done"
            job["steps"].append({"step": "done", "status": "completed", "timestamp": time.time()})

    async def set_error(self, job_id: str, error: str) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job["status"] = "failed"
            job["error"] = error

    def _cleanup_expired(self) -> None:
        now = time.time()
        expired = [k for k, v in self._jobs.items() if now - v["createdAt"] > self._ttl]
        for k in expired:
            del self._jobs[k]


store = JobStore()
