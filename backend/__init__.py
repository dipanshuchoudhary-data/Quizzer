import asyncio
import sys


# Force selector event loop policy on Windows before any backend module
# initializes async DB connections (psycopg async is incompatible with Proactor).
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
