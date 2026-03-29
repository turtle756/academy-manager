from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.database import engine, Base
from app.routers import auth, academies, classrooms, students, schedules, attendance, payments, grades, counseling, notices, stats, documents, parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
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
_static_dir: Path | None = None
for candidate in [
    Path(__file__).parent.parent / "frontend" / "dist",       # /app/frontend/dist (Docker)
    Path(__file__).parent.parent.parent / "frontend" / "dist", # local dev
]:
    if candidate.exists():
        _static_dir = candidate
        app.mount("/assets", StaticFiles(directory=str(candidate / "assets")), name="static-assets")
        break


@app.get("/{full_path:path}")
async def serve_spa(request: Request, full_path: str):
    if _static_dir is None:
        return {"detail": "Frontend not built"}
    # Try to serve the exact file first
    file_path = _static_dir / full_path
    if file_path.is_file():
        return FileResponse(file_path)
    # Otherwise return index.html for SPA routing
    return FileResponse(_static_dir / "index.html")
