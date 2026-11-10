import os
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, async_session_maker
from app.models import User, RoleEnum
from app.auth import hash_password
from app.routers import auth, documents, audit
from sqlalchemy import select

app = FastAPI(title="TrustVault API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(audit.router)

@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Seed default test users
    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.email == "admin@trustvault.local"))
        if not result.scalars().first():
            admin = User(
                email="admin@trustvault.local",
                password_hash=hash_password("Admin@123"),
                role=RoleEnum.ADMIN
            )
            alice = User(
                email="alice@trustvault.local",
                password_hash=hash_password("Password@123"),
                role=RoleEnum.USER
            )
            bob = User(
                email="bob@trustvault.local",
                password_hash=hash_password("Password@123"),
                role=RoleEnum.USER
            )
            session.add_all([admin, alice, bob])
            await session.commit()

@app.get("/")
def read_root():
    return {"message": "TrustVault API is running securely."}
