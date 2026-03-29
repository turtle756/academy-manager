from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.attendance import Attendance, AttendanceStatus
from app.models.payment import Invoice, InvoiceStatus
from app.models.student import Student

router = APIRouter()


@router.get("/dashboard")
async def dashboard_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    academy_id = user.academy_id

    # Today's attendance
    today_total = await db.execute(
        select(func.count()).select_from(Attendance).where(
            Attendance.academy_id == academy_id,
            Attendance.date == today,
        )
    )
    today_present = await db.execute(
        select(func.count()).select_from(Attendance).where(
            Attendance.academy_id == academy_id,
            Attendance.date == today,
            Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE]),
        )
    )

    # This month attendance rate
    first_of_month = today.replace(day=1)
    month_total = await db.execute(
        select(func.count()).select_from(Attendance).where(
            Attendance.academy_id == academy_id,
            Attendance.date >= first_of_month,
        )
    )
    month_present = await db.execute(
        select(func.count()).select_from(Attendance).where(
            Attendance.academy_id == academy_id,
            Attendance.date >= first_of_month,
            Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE]),
        )
    )

    # Unpaid invoices
    unpaid = await db.execute(
        select(func.count(), func.coalesce(func.sum(Invoice.amount), 0)).select_from(Invoice).where(
            Invoice.academy_id == academy_id,
            Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]),
        )
    )
    unpaid_row = unpaid.one()

    total_count = today_total.scalar() or 0
    present_count = today_present.scalar() or 0
    m_total = month_total.scalar() or 0
    m_present = month_present.scalar() or 0

    return {
        "today_attendance": {
            "present": present_count,
            "total": total_count,
            "rate": round(present_count / total_count * 100, 1) if total_count > 0 else 0,
        },
        "month_attendance_rate": round(m_present / m_total * 100, 1) if m_total > 0 else 0,
        "unpaid": {
            "count": unpaid_row[0],
            "amount": unpaid_row[1],
        },
    }


@router.get("/attendance-trend")
async def attendance_trend(
    months: int = 6,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    trends = []

    for i in range(months - 1, -1, -1):
        month_date = today.replace(day=1) - timedelta(days=30 * i)
        month_start = month_date.replace(day=1)
        if month_start.month == 12:
            month_end = month_start.replace(year=month_start.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            month_end = month_start.replace(month=month_start.month + 1, day=1) - timedelta(days=1)

        total = await db.execute(
            select(func.count()).select_from(Attendance).where(
                Attendance.academy_id == user.academy_id,
                Attendance.date >= month_start,
                Attendance.date <= month_end,
            )
        )
        present = await db.execute(
            select(func.count()).select_from(Attendance).where(
                Attendance.academy_id == user.academy_id,
                Attendance.date >= month_start,
                Attendance.date <= month_end,
                Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE]),
            )
        )

        t = total.scalar() or 0
        p = present.scalar() or 0
        trends.append({
            "month": month_start.strftime("%Y-%m"),
            "rate": round(p / t * 100, 1) if t > 0 else 0,
        })

    return trends


@router.get("/at-risk")
async def at_risk_students(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """최근 30일 출석률이 80% 미만인 학생"""
    thirty_days_ago = date.today() - timedelta(days=30)

    result = await db.execute(
        select(
            Attendance.student_id,
            func.count().label("total"),
            func.count().filter(
                Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE])
            ).label("present"),
        )
        .where(
            Attendance.academy_id == user.academy_id,
            Attendance.date >= thirty_days_ago,
        )
        .group_by(Attendance.student_id)
    )

    at_risk = []
    for row in result.all():
        rate = round(row.present / row.total * 100, 1) if row.total > 0 else 0
        if rate < 80:
            student = await db.get(Student, row.student_id)
            at_risk.append({
                "student_id": row.student_id,
                "student_name": student.name if student else "",
                "attendance_rate": rate,
                "total_classes": row.total,
                "present_classes": row.present,
            })

    at_risk.sort(key=lambda x: x["attendance_rate"])
    return at_risk[:10]
