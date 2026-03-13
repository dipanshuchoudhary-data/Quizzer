import asyncio
import sys


# Ensure Psycopg async works on Windows across all entry points
# (uvicorn, alembic, scripts, tests) by forcing selector loop policy
# at interpreter startup.
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
