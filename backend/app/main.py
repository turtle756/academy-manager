from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.database import engine, Base
from app.routers import auth, academies, classrooms, students, schedules, attendance, payments, grades, counseling, stats, documents, parent, invitations, kiosk, nlp, rooms


@asynccontextmanager
async def lifespan(app: FastAPI):
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Schema migrations (idempotent)
        await conn.execute(text("ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS monthly_fee INTEGER NOT NULL DEFAULT 0"))
        await conn.execute(text("ALTER TYPE memberrole ADD VALUE IF NOT EXISTS 'vice_owner'"))
        await conn.execute(text("ALTER TABLE counselings ADD COLUMN IF NOT EXISTS counseling_type VARCHAR(30) NOT NULL DEFAULT 'regular'"))
        await conn.execute(text("ALTER TABLE counselings ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'completed'"))
        await conn.execute(text("ALTER TABLE counselings ADD COLUMN IF NOT EXISTS issue TEXT"))
        await conn.execute(text("ALTER TABLE counselings ADD COLUMN IF NOT EXISTS agreement TEXT"))
        await conn.execute(text("ALTER TABLE counselings ADD COLUMN IF NOT EXISTS followup TEXT"))
        await conn.execute(text("ALTER TABLE counselings ADD COLUMN IF NOT EXISTS result VARCHAR(50)"))
        await conn.execute(text("ALTER TABLE counselings ADD COLUMN IF NOT EXISTS next_date DATE"))
        await conn.execute(text("ALTER TABLE counselings ALTER COLUMN title DROP NOT NULL"))
        await conn.execute(text("ALTER TABLE counselings ALTER COLUMN content DROP NOT NULL"))
        await conn.execute(text("ALTER TABLE counselings ALTER COLUMN content SET DEFAULT ''"))
        await conn.execute(text("ALTER TABLE schedules ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES rooms(id)"))
        await conn.execute(text("ALTER TABLE students ADD COLUMN IF NOT EXISTS monthly_fee INTEGER NOT NULL DEFAULT 0"))
        await conn.execute(text("ALTER TABLE students ADD COLUMN IF NOT EXISTS payment_due_day INTEGER NOT NULL DEFAULT 10"))
    yield


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_credentials=False,
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
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(parent.router, prefix="/api/parent", tags=["parent"])
app.include_router(invitations.router, prefix="/api/invitations", tags=["invitations"])
app.include_router(kiosk.router, prefix="/api/kiosk", tags=["kiosk"])
app.include_router(nlp.router, prefix="/api/nlp", tags=["nlp"])
app.include_router(rooms.router, prefix="/api/rooms", tags=["rooms"])

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
