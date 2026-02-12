import redis.asyncio as redis
from backend.core.config import settings
from datetime import timedelta

redis_client = redis.from_url(
    settings.REDIS_URL,
    decode_response=True,
)
## Exam timer

async def create_exam_timer(attempt_id:str,duration_seconds:int):
    key=f"exam:timer:{attempt_id}"
    await redis_client.set(key,duration_seconds,ex=duration_seconds)

async def get_remaining_time(attempt_id:str) -> int | None:
    key = f"exam:timer:{attempt_id}"
    return await redis_client.ttl(key)

## Heartbeat

async def set_heartbeat(attempt_id:str):
    key=f"exam:heartbeat:{attempt_id}"
    await redis_client.set(key,"alive",ex=60)

## Violations

async def increment_violation(attempt_id:str,violation_type:str):
    key=f"exam:violations:{attempt_id}"
    await redis_client.hincrby(key,violation_type,1)

## Lock -- multisession

async def lock_attempt_session(attempt_id:str):
    key=f"exam:lock:{attempt_id}"
    return await redis_client.set(key,"locked",nx=True,ex=3600)