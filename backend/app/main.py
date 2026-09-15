from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

import app.database as db
from app.config import settings
from app.routes import registration, verification, attendance

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — try connecting to MongoDB
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        client = AsyncIOMotorClient(settings.mongodb_url, serverSelectionTimeoutMS=3000)
        # Test connection
        await client.admin.command('ping')
        db.client = client
        db.db = client[settings.database_name]
        db.USE_MONGO = True
        print(f"[OK] MongoDB connected: {settings.mongodb_url}")
    except Exception as e:
        print(f"[WARN] MongoDB not available ({e})")
        print("   Using IN-MEMORY database (data will be lost on restart)")
        db.USE_MONGO = False
    
    yield
    
    # Shutdown
    if db.client:
        db.client.close()

app = FastAPI(title="Smart Attendance System", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(registration.router, prefix="/api", tags=["registration"])
app.include_router(verification.router, prefix="/api", tags=["verification"])
app.include_router(attendance.router, prefix="/api", tags=["attendance"])

@app.get("/")
async def root():
    return {
        "message": "Welcome to Smart Attendance System API",
        "docs": "/docs",
        "database": "MongoDB" if db.USE_MONGO else "In-Memory (testing mode)"
    }
