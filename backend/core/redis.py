import redis.asyncio as redis
from backend.core.config import settings


redis_client = redis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
)


# -------------------------------------------------
# EXAM TIMER (Authoritative)
# -------------------------------------------------

async def start_exam_timer(attempt_id: str, duration_seconds: int):
    """
    Starts authoritative exam timer.
    TTL becomes single source of truth.
    """
    key = f"exam:timer:{attempt_id}"
    await redis_client.set(key, "running", ex=duration_seconds)


async def get_remaining_time(attempt_id: str) -> int:
    key = f"exam:timer:{attempt_id}"
    ttl = await redis_client.ttl(key)
    return ttl


async def exam_expired(attempt_id: str) -> bool:
    ttl = await get_remaining_time(attempt_id)
    return ttl is None or ttl <= 0


# -------------------------------------------------
# HEARTBEAT
# -------------------------------------------------

async def set_heartbeat(attempt_id: str):
    key = f"exam:heartbeat:{attempt_id}"
    await redis_client.set(key, "alive", ex=60)


# -------------------------------------------------
# VIOLATIONS
# -------------------------------------------------

async def increment_violation(attempt_id: str, violation_type: str):
    key = f"exam:violations:{attempt_id}"
    await redis_client.hincrby(key, violation_type, 1)


async def get_violation_count(attempt_id: str) -> int:
    key = f"exam:violations:{attempt_id}"
    data = await redis_client.hgetall(key)
    return sum(int(v) for v in data.values()) if data else 0


# -------------------------------------------------
# MULTI-SESSION LOCK
# -------------------------------------------------

async def lock_attempt_session(attempt_id: str) -> bool:
    key = f"exam:lock:{attempt_id}"
    return await redis_client.set(key, "locked", nx=True, ex=7200)
