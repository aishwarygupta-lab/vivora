#!/usr/bin/env python
"""
Seed a single demo login user so a fresh install can sign in immediately.

Idempotent: safe to run on every container start. Credentials are intentionally
well-known and shown on the login page — this is a demo account, not a secret.

Run:  python seed_user.py   (from the backend dir, with DATABASE_URL set)
"""

import asyncio

from sqlalchemy import select

from app.api.v1.users import get_password_hash
from app.database import AsyncSessionLocal
from app.models import User

DEMO_EMAIL = "demo@vivora.app"
DEMO_USERNAME = "demo"
DEMO_FULL_NAME = "Vivora Demo"
DEMO_PASSWORD = "VivoraDemo123!"


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == DEMO_EMAIL))
        user = result.scalar_one_or_none()

        if user is not None:
            # Heal an older empty-password demo user so login actually works.
            if not user.hashed_password:
                user.hashed_password = get_password_hash(DEMO_PASSWORD)
                await db.commit()
                print(f"[seed_user] Reset password for existing demo user {DEMO_EMAIL}")
            else:
                print(f"[seed_user] Demo user {DEMO_EMAIL} already present — skipping")
            return

        # `username` is UNIQUE. Older deployments seeded an anonymous
        # "demo"/"demo@localhost" placeholder row (pre-dating this script) that
        # would otherwise collide with the insert below and make it fail
        # silently — the exact bug this script exists to avoid. Repurpose that
        # row into the real login account instead of inserting a new one.
        legacy = await db.execute(select(User).where(User.username == DEMO_USERNAME))
        legacy_user = legacy.scalar_one_or_none()
        if legacy_user is not None:
            legacy_user.email = DEMO_EMAIL
            legacy_user.full_name = DEMO_FULL_NAME
            legacy_user.hashed_password = get_password_hash(DEMO_PASSWORD)
            legacy_user.is_active = True
            await db.commit()
            print(f"[seed_user] Migrated legacy demo user to {DEMO_EMAIL} / {DEMO_PASSWORD}")
            return

        db.add(
            User(
                email=DEMO_EMAIL,
                username=DEMO_USERNAME,
                full_name=DEMO_FULL_NAME,
                hashed_password=get_password_hash(DEMO_PASSWORD),
                is_active=True,
            )
        )
        await db.commit()
        print(f"[seed_user] Seeded demo user {DEMO_EMAIL} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())
