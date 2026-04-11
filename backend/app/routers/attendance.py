from datetime import date as date_cls

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_membership
from app.models.user_academy import UserAcademy
from app.models.student import Student
from app.models.attendance import Attendance, AttendanceMethod, AttendanceStatus
from app.models.classroom import StudentClassroom

router = APIRouter()


class NFCCheckIn(BaseModel):
    nfc_uid: str


class PINCheckIn(BaseModel):
    pin_code: str
    classroom_id: int | None = None


class ManualSet(BaseModel):
    student_id: int
    date: str
    status: AttendanceStatus
    classroom_id: int | None = None


# ============ 키오스크 출석 ============

async def _kiosk_check_in(student: Student, method: AttendanceMethod, db: AsyncSession) -> dict:
    """키오스크 출석 — 인증 없이 카드/PIN으로 바로 출석 처리"""
    today = date_cls.today()

    # 학생이 속한 반 찾기 (여러 개면 첫 번째)
    enrolled = await db.execute(
        select(StudentClassroom.classroom_id).where(StudentClassroom.student_id == student.id)
    )
    classroom_ids = [row[0] for row in enrolled.all()]
    classroom_id = classroom_ids[0] if classroom_ids else None

    # 오늘 이미 출석했는지 확인
    existing = await db.execute(
        select(Attendance).where(
            Attendance.student_id == student.id,
            Attendance.date == today,
        )
    )
    if existing.scalar_one_or_none():
        return {"ok": True, "student_name": student.name, "status": "already_checked", "method": method.value}

    attendance = Attendance(
        student_id=student.id,
        session_id=None,
        classroom_id=classroom_id,
        academy_id=student.academy_id,
        status=AttendanceStatus.PRESENT,
        method=method,
        date=today,
    )
    db.add(attendance)
    await db.commit()
    return {"ok": True, "student_name": student.name, "status": "present", "method": method.value}


@router.post("/check-in/nfc")
async def nfc_check_in(data: NFCCheckIn, db: AsyncSession = Depends(get_db)):
    """NFC 카드 UID로 출석 (키오스크 전용, 인증 선택적)"""
    result = await db.execute(select(Student).where(Student.nfc_uid == data.nfc_uid))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=400, detail="등록되지 않은 NFC 카드입니다")
    return await _kiosk_check_in(student, AttendanceMethod.KIOSK, db)


@router.post("/check-in/pin")
async def pin_check_in(data: PINCheckIn, db: AsyncSession = Depends(get_db)):
    """PIN으로 출석 (키오스크 전용)"""
    result = await db.execute(select(Student).where(Student.pin_code == data.pin_code))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=400, detail="유효하지 않은 PIN입니다")
    return await _kiosk_check_in(student, AttendanceMethod.PIN, db)


# ============ 관리자 수동 처리 ============

@router.post("/manual-set")
async def manual_set_attendance(
    data: ManualSet,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    """관리자가 학생 출석 상태를 수동으로 설정 (있으면 업데이트, 없으면 생성)"""
    student = await db.get(Student, data.student_id)
    if not student or student.academy_id != membership.academy_id:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다")

    target_date = date_cls.fromisoformat(data.date)

    # 같은 날짜의 기존 기록 찾기
    result = await db.execute(
        select(Attendance).where(
            Attendance.student_id == data.student_id,
            Attendance.date == target_date,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.status = data.status
        existing.method = AttendanceMethod.MANUAL
    else:
        # 학생이 속한 반 찾기
        classroom_id = data.classroom_id
        if classroom_id is None:
            enrolled = await db.execute(
                select(StudentClassroom.classroom_id).where(StudentClassroom.student_id == data.student_id)
            )
            row = enrolled.first()
            classroom_id = row[0] if row else None

        db.add(Attendance(
            student_id=data.student_id,
            session_id=None,
            classroom_id=classroom_id,
            academy_id=membership.academy_id,
            status=data.status,
            method=AttendanceMethod.MANUAL,
            date=target_date,
        ))

    await db.commit()
    return {"ok": True}


@router.delete("/{attendance_id}")
async def delete_attendance(
    attendance_id: int,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    """출석 기록 삭제"""
    attendance = await db.get(Attendance, attendance_id)
    if not attendance or attendance.academy_id != membership.academy_id:
        raise HTTPException(status_code=404)
    await db.delete(attendance)
    await db.commit()
    return {"ok": True}


# ============ 조회 ============

@router.get("/history")
async def attendance_history(
    classroom_id: int | None = None,
    student_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    query = select(Attendance).where(Attendance.academy_id == membership.academy_id)

    if classroom_id:
        query = query.where(Attendance.classroom_id == classroom_id)
    if student_id:
        query = query.where(Attendance.student_id == student_id)
    if start_date:
        query = query.where(Attendance.date >= date_cls.fromisoformat(start_date))
    if end_date:
        query = query.where(Attendance.date <= date_cls.fromisoformat(end_date))

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
