import secrets
import random
import string
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db, async_session
from app.core.auth import get_current_user
from app.models.user import User
from app.models.student import Student
from app.models.attendance import Attendance, AttendanceSession, AttendanceMethod, AttendanceStatus
from app.models.classroom import StudentClassroom

router = APIRouter()

# WebSocket connections for real-time attendance updates
active_connections: dict[int, list[WebSocket]] = {}


class StartSession(BaseModel):
    classroom_id: int
    schedule_id: int | None = None
    method: AttendanceMethod


class ManualAttendance(BaseModel):
    student_id: int
    status: AttendanceStatus


class QRCheckIn(BaseModel):
    qr_code: str


class PINCheckIn(BaseModel):
    pin_code: str
    classroom_id: int


class QRCardCheckIn(BaseModel):
    qr_token: str  # 학생 고유 QR 토큰 (카드에 인쇄된 것)


class NFCCheckIn(BaseModel):
    nfc_uid: str  # NFC 카드 UID


async def notify_session(session_id: int, data: dict):
    for ws in active_connections.get(session_id, []):
        try:
            await ws.send_json(data)
        except Exception:
            pass


@router.post("/sessions")
async def start_attendance_session(
    data: StartSession,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Close any active sessions for this classroom today
    result = await db.execute(
        select(AttendanceSession).where(
            AttendanceSession.classroom_id == data.classroom_id,
            AttendanceSession.academy_id == user.academy_id,
            AttendanceSession.date == date.today(),
            AttendanceSession.is_active == True,
        )
    )
    for old_session in result.scalars().all():
        old_session.is_active = False
        old_session.closed_at = datetime.now(timezone.utc)

    session = AttendanceSession(
        classroom_id=data.classroom_id,
        schedule_id=data.schedule_id,
        academy_id=user.academy_id,
        method=data.method,
        qr_code=secrets.token_urlsafe(16) if data.method == AttendanceMethod.QR else None,
        pin_code="".join(random.choices(string.digits, k=4)) if data.method == AttendanceMethod.PIN else None,
        date=date.today(),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return {
        "id": session.id,
        "classroom_id": session.classroom_id,
        "method": session.method.value,
        "qr_code": session.qr_code,
        "pin_code": session.pin_code,
        "date": str(session.date),
        "is_active": session.is_active,
    }


@router.post("/sessions/{session_id}/refresh-qr")
async def refresh_qr(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(AttendanceSession, session_id)
    if not session or session.academy_id != user.academy_id:
        raise HTTPException(status_code=404)

    session.qr_code = secrets.token_urlsafe(16)
    await db.commit()

    await notify_session(session_id, {"type": "qr_refresh", "qr_code": session.qr_code})
    return {"qr_code": session.qr_code}


@router.post("/sessions/{session_id}/close")
async def close_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(AttendanceSession, session_id)
    if not session or session.academy_id != user.academy_id:
        raise HTTPException(status_code=404)

    session.is_active = False
    session.closed_at = datetime.now(timezone.utc)
    await db.commit()

    # Mark absent students
    enrolled = await db.execute(
        select(StudentClassroom.student_id).where(
            StudentClassroom.classroom_id == session.classroom_id
        )
    )
    enrolled_ids = {row[0] for row in enrolled.all()}

    attended = await db.execute(
        select(Attendance.student_id).where(Attendance.session_id == session_id)
    )
    attended_ids = {row[0] for row in attended.all()}

    for student_id in enrolled_ids - attended_ids:
        db.add(Attendance(
            student_id=student_id,
            session_id=session_id,
            classroom_id=session.classroom_id,
            academy_id=session.academy_id,
            status=AttendanceStatus.ABSENT,
            method=AttendanceMethod.MANUAL,
            date=session.date,
        ))
    await db.commit()

    await notify_session(session_id, {"type": "session_closed"})
    return {"ok": True}


@router.post("/check-in/qr")
async def qr_check_in(
    data: QRCheckIn,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AttendanceSession).where(
            AttendanceSession.qr_code == data.qr_code,
            AttendanceSession.is_active == True,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=400, detail="유효하지 않은 QR코드입니다")

    return {"session_id": session.id, "classroom_id": session.classroom_id}


@router.post("/check-in/pin")
async def pin_check_in(
    data: PINCheckIn,
    db: AsyncSession = Depends(get_db),
):
    # Find student by PIN
    result = await db.execute(
        select(Student).where(Student.pin_code == data.pin_code)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=400, detail="유효하지 않은 PIN입니다")

    # Find active session for this classroom
    result = await db.execute(
        select(AttendanceSession).where(
            AttendanceSession.classroom_id == data.classroom_id,
            AttendanceSession.is_active == True,
            AttendanceSession.date == date.today(),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=400, detail="활성화된 출석 세션이 없습니다")

    # Check if already checked in
    existing = await db.execute(
        select(Attendance).where(
            Attendance.student_id == student.id,
            Attendance.session_id == session.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="이미 출석했습니다")

    attendance = Attendance(
        student_id=student.id,
        session_id=session.id,
        classroom_id=session.classroom_id,
        academy_id=session.academy_id,
        status=AttendanceStatus.PRESENT,
        method=AttendanceMethod.PIN,
        date=date.today(),
    )
    db.add(attendance)
    await db.commit()

    await notify_session(session.id, {
        "type": "check_in",
        "student_id": student.id,
        "student_name": student.name,
        "status": "present",
        "method": "pin",
    })

    return {"ok": True, "student_name": student.name, "status": "present"}


@router.post("/sessions/{session_id}/manual")
async def manual_attendance(
    session_id: int,
    data: ManualAttendance,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(AttendanceSession, session_id)
    if not session or session.academy_id != user.academy_id:
        raise HTTPException(status_code=404)

    # Upsert
    result = await db.execute(
        select(Attendance).where(
            Attendance.student_id == data.student_id,
            Attendance.session_id == session_id,
        )
    )
    attendance = result.scalar_one_or_none()

    if attendance:
        attendance.status = data.status
        attendance.method = AttendanceMethod.MANUAL
    else:
        attendance = Attendance(
            student_id=data.student_id,
            session_id=session_id,
            classroom_id=session.classroom_id,
            academy_id=session.academy_id,
            status=data.status,
            method=AttendanceMethod.MANUAL,
            date=session.date,
        )
        db.add(attendance)

    await db.commit()

    student = await db.get(Student, data.student_id)
    await notify_session(session_id, {
        "type": "check_in",
        "student_id": data.student_id,
        "student_name": student.name if student else "",
        "status": data.status.value,
        "method": "manual",
    })

    return {"ok": True}


@router.get("/sessions/{session_id}")
async def get_session_attendance(
    session_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(AttendanceSession, session_id)
    if not session or session.academy_id != user.academy_id:
        raise HTTPException(status_code=404)

    result = await db.execute(
        select(Attendance)
        .where(Attendance.session_id == session_id)
        .options(selectinload(Attendance.student))
    )
    attendances = result.scalars().all()

    return {
        "session": {
            "id": session.id,
            "classroom_id": session.classroom_id,
            "method": session.method.value,
            "qr_code": session.qr_code,
            "pin_code": session.pin_code,
            "date": str(session.date),
            "is_active": session.is_active,
        },
        "attendances": [
            {
                "student_id": a.student_id,
                "student_name": a.student.name,
                "status": a.status.value,
                "method": a.method.value,
                "checked_at": a.checked_at.isoformat() if a.checked_at else None,
            }
            for a in attendances
        ],
    }


@router.get("/history")
async def attendance_history(
    classroom_id: int | None = None,
    student_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Attendance).where(Attendance.academy_id == user.academy_id)

    if classroom_id:
        query = query.where(Attendance.classroom_id == classroom_id)
    if student_id:
        query = query.where(Attendance.student_id == student_id)
    if start_date:
        query = query.where(Attendance.date >= date.fromisoformat(start_date))
    if end_date:
        query = query.where(Attendance.date <= date.fromisoformat(end_date))

    query = query.options(selectinload(Attendance.student)).order_by(Attendance.date.desc())
    result = await db.execute(query)

    return [
        {
            "id": a.id,
            "student_id": a.student_id,
            "student_name": a.student.name,
            "classroom_id": a.classroom_id,
            "status": a.status.value,
            "method": a.method.value,
            "date": str(a.date),
            "checked_at": a.checked_at.isoformat() if a.checked_at else None,
        }
        for a in result.scalars().all()
    ]


async def _kiosk_check_in(student: Student, method: AttendanceMethod, db: AsyncSession) -> dict:
    """키오스크 공통 출석 처리 — 활성 세션 찾아서 출석 기록"""
    # Find any active session for student's classrooms
    from app.models.classroom import StudentClassroom
    enrolled = await db.execute(
        select(StudentClassroom.classroom_id).where(StudentClassroom.student_id == student.id)
    )
    classroom_ids = [row[0] for row in enrolled.all()]

    if not classroom_ids:
        # No classroom — just record academy-level attendance
        attendance = Attendance(
            student_id=student.id,
            session_id=None,
            classroom_id=None,
            academy_id=student.academy_id,
            status=AttendanceStatus.PRESENT,
            method=method,
            date=date.today(),
        )
        db.add(attendance)
        await db.commit()
        return {"ok": True, "student_name": student.name, "status": "present", "method": method.value}

    # Find active session for any of student's classrooms
    result = await db.execute(
        select(AttendanceSession).where(
            AttendanceSession.classroom_id.in_(classroom_ids),
            AttendanceSession.is_active == True,
            AttendanceSession.date == date.today(),
        )
    )
    session = result.scalar_one_or_none()

    classroom_id = session.classroom_id if session else classroom_ids[0]
    session_id = session.id if session else None

    # Check duplicate
    dup_query = select(Attendance).where(
        Attendance.student_id == student.id,
        Attendance.date == date.today(),
        Attendance.classroom_id == classroom_id,
    )
    if session_id:
        dup_query = dup_query.where(Attendance.session_id == session_id)
    existing = await db.execute(dup_query)
    if existing.scalar_one_or_none():
        return {"ok": True, "student_name": student.name, "status": "already_checked", "method": method.value}

    attendance = Attendance(
        student_id=student.id,
        session_id=session_id,
        classroom_id=classroom_id,
        academy_id=student.academy_id,
        status=AttendanceStatus.PRESENT,
        method=method,
        date=date.today(),
    )
    db.add(attendance)
    await db.commit()

    if session_id:
        await notify_session(session_id, {
            "type": "check_in",
            "student_id": student.id,
            "student_name": student.name,
            "status": "present",
            "method": method.value,
        })

    return {"ok": True, "student_name": student.name, "status": "present", "method": method.value}


@router.post("/check-in/qr-card")
async def qr_card_check_in(
    data: QRCardCheckIn,
    db: AsyncSession = Depends(get_db),
):
    """학생 고유 QR 카드로 출석"""
    # Extract token — format is "ACADEMY_CHECKIN:<token>"
    token = data.qr_token
    if token.startswith("ACADEMY_CHECKIN:"):
        token = token.split(":", 1)[1]

    result = await db.execute(
        select(Student).where(Student.qr_token == token)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=400, detail="유효하지 않은 QR 카드입니다")

    return await _kiosk_check_in(student, AttendanceMethod.QR, db)


@router.post("/check-in/nfc")
async def nfc_check_in(
    data: NFCCheckIn,
    db: AsyncSession = Depends(get_db),
):
    """NFC 카드 UID로 출석"""
    result = await db.execute(
        select(Student).where(Student.nfc_uid == data.nfc_uid)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=400, detail="등록되지 않은 NFC 카드입니다")

    return await _kiosk_check_in(student, AttendanceMethod.KIOSK, db)


@router.websocket("/ws/{session_id}")
async def attendance_ws(websocket: WebSocket, session_id: int):
    await websocket.accept()
    if session_id not in active_connections:
        active_connections[session_id] = []
    active_connections[session_id].append(websocket)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections[session_id].remove(websocket)
        if not active_connections[session_id]:
            del active_connections[session_id]
