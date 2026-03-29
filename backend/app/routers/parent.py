from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.student import Student
from app.models.attendance import Attendance
from app.models.grade import Grade
from app.models.payment import Invoice
from app.models.notice import Notice

router = APIRouter()


class ParentAuth(BaseModel):
    phone: str  # 학부모 전화번호


@router.post("/verify")
async def verify_parent(
    data: ParentAuth,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Student).where(Student.parent_phone == data.phone)
    )
    students = result.scalars().all()

    if not students:
        raise HTTPException(status_code=404, detail="등록된 학생이 없습니다")

    return [
        {"id": s.id, "name": s.name, "academy_id": s.academy_id}
        for s in students
    ]


@router.get("/attendance/{student_id}")
async def parent_attendance(
    student_id: int,
    phone: str,
    month: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    student = await db.get(Student, student_id)
    if not student or student.parent_phone != phone:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")

    if month:
        year, m = month.split("-")
        start = date(int(year), int(m), 1)
        if int(m) == 12:
            end = date(int(year) + 1, 1, 1)
        else:
            end = date(int(year), int(m) + 1, 1)
    else:
        today = date.today()
        start = today.replace(day=1)
        end = today + timedelta(days=1)

    result = await db.execute(
        select(Attendance)
        .where(
            Attendance.student_id == student_id,
            Attendance.date >= start,
            Attendance.date < end,
        )
        .order_by(Attendance.date)
    )

    attendances = result.scalars().all()
    present = sum(1 for a in attendances if a.status.value in ("present", "late"))
    absent = sum(1 for a in attendances if a.status.value == "absent")
    late = sum(1 for a in attendances if a.status.value == "late")

    return {
        "student_name": student.name,
        "records": [
            {"date": str(a.date), "status": a.status.value, "checked_at": a.checked_at.isoformat() if a.checked_at else None}
            for a in attendances
        ],
        "summary": {
            "present": present,
            "late": late,
            "absent": absent,
            "rate": round(present / len(attendances) * 100, 1) if attendances else 0,
        },
    }


@router.get("/grades/{student_id}")
async def parent_grades(
    student_id: int,
    phone: str,
    db: AsyncSession = Depends(get_db),
):
    student = await db.get(Student, student_id)
    if not student or student.parent_phone != phone:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")

    result = await db.execute(
        select(Grade)
        .where(Grade.student_id == student_id)
        .order_by(Grade.date.desc())
    )

    return [
        {
            "exam_name": g.exam_name,
            "score": g.score,
            "total_score": g.total_score,
            "date": str(g.date),
        }
        for g in result.scalars().all()
    ]


@router.get("/invoices/{student_id}")
async def parent_invoices(
    student_id: int,
    phone: str,
    db: AsyncSession = Depends(get_db),
):
    student = await db.get(Student, student_id)
    if not student or student.parent_phone != phone:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")

    result = await db.execute(
        select(Invoice)
        .where(Invoice.student_id == student_id)
        .order_by(Invoice.due_date.desc())
    )

    return [
        {
            "id": inv.id,
            "amount": inv.amount,
            "description": inv.description,
            "status": inv.status.value,
            "due_date": str(inv.due_date),
            "paid_date": str(inv.paid_date) if inv.paid_date else None,
        }
        for inv in result.scalars().all()
    ]


@router.get("/notices/{academy_id}")
async def parent_notices(
    academy_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notice)
        .where(Notice.academy_id == academy_id)
        .order_by(Notice.created_at.desc())
        .limit(20)
    )

    return [
        {"id": n.id, "title": n.title, "content": n.content, "created_at": n.created_at.isoformat()}
        for n in result.scalars().all()
    ]
