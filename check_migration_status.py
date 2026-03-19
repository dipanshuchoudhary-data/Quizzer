#!/usr/bin/env python
"""Diagnostic script to check migration status."""

import asyncio
from sqlalchemy import text, inspect
from sqlalchemy.ext.asyncio import create_async_engine

from backend.core.config import settings


async def check_migration_status():
    """Check which migrations have been applied."""
    print("=" * 70)
    print("MIGRATION STATUS DIAGNOSTIC")
    print("=" * 70)
    
    # Create async engine
    engine = create_async_engine(settings.POSTGRES_DSN)
    
    try:
        async with engine.begin() as conn:
            # 1. Check alembic_version table
            print("\n[1] Checking alembic_version table...")
            try:
                result = await conn.execute(
                    text("SELECT version_num, is_branch FROM alembic_version ORDER BY version_num DESC;")
                )
                rows = result.fetchall()
                if rows:
                    print(f"✓ Found {len(rows)} applied migrations:")
                    for row in rows:
                        print(f"  - {row[0]}")
                else:
                    print("✗ No migrations applied yet!")
            except Exception as e:
                print(f"✗ Error checking alembic_version: {e}")
            
            # 2. Check if 'settings' column exists in quizzes table
            print("\n[2] Checking 'settings' column in quizzes table...")
            try:
                result = await conn.execute(
                    text("""
                        SELECT column_name, data_type, is_nullable
                        FROM information_schema.columns
                        WHERE table_name = 'quizzes' AND column_name = 'settings';
                    """)
                )
                row = result.fetchone()
                if row:
                    print(f"✓ Column 'settings' EXISTS")
                    print(f"  - Type: {row[1]}")
                    print(f"  - Nullable: {row[2]}")
                else:
                    print("✗ Column 'settings' DOES NOT EXIST in quizzes table")
            except Exception as e:
                print(f"✗ Error checking column: {e}")
            
            # 3. List all columns in quizzes table
            print("\n[3] All columns in quizzes table:")
            try:
                result = await conn.execute(
                    text("""
                        SELECT column_name, data_type
                        FROM information_schema.columns
                        WHERE table_name = 'quizzes'
                        ORDER BY ordinal_position;
                    """)
                )
                rows = result.fetchall()
                for row in rows:
                    print(f"  - {row[0]}: {row[1]}")
            except Exception as e:
                print(f"✗ Error listing columns: {e}")
            
            # 4. Check if public_slug column is still there
            print("\n[4] Checking public_slug column...")
            try:
                result = await conn.execute(
                    text("""
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name = 'quizzes' AND column_name = 'public_slug';
                    """)
                )
                row = result.fetchone()
                if row:
                    print("! public_slug column STILL EXISTS (migration not applied)")
                else:
                    print("✓ public_slug column removed (migration was applied)")
            except Exception as e:
                print(f"✗ Error: {e}")
            
            # 5. Check database URL
            print(f"\n[5] Database Connection URL:")
            print(f"  - {settings.POSTGRES_DSN}")
            
    finally:
        await engine.dispose()
    
    print("\n" + "=" * 70)


if __name__ == "__main__":
    asyncio.run(check_migration_status())
