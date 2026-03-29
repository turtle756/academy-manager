from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine, Base
from app.routers import auth, academies, classrooms, students, schedules, attendance, payments, grades, counseling, notices, stats, documents, parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(academies.router, prefix="/api/academies", tags=["academies"])
app.include_router(classrooms.router, prefix="/api/classrooms", tags=["classrooms"])
app.include_router(students.router, prefix="/api/students", tags=["students"])
app.include_router(schedules.router, prefix="/api/schedules", tags=["schedules"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["attendance"])
app.include_router(payments.router, prefix="/api/payments", tags=["payments"])
app.include_router(grades.router, prefix="/api/grades", tags=["grades"])
app.include_router(counseling.router, prefix="/api/counseling", tags=["counseling"])
app.include_router(notices.router, prefix="/api/notices", tags=["notices"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(parent.router, prefix="/api/parent", tags=["parent"])

# Serve React build in production
# Check multiple possible paths for the frontend build
for candidate in [
    Path(__file__).parent.parent / "frontend" / "dist",       # /app/frontend/dist (Docker)
    Path(__file__).parent.parent.parent / "frontend" / "dist", # local dev
]:
    if candidate.exists():
        app.mount("/", StaticFiles(directory=str(candidate), html=True), name="frontend")
        break
