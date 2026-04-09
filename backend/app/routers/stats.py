from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_membership
from app.models.user_academy import UserAcademy
from app.models.attendance import Attendance, AttendanceStatus
from app.models.payment import Invoice, InvoiceStatus
from app.models.student import Student

router = APIRouter()


@router.get("/dashboard")
async def dashboard_stats(
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    aid = membership.academy_id

    today_total = (await db.execute(select(func.count()).select_from(Attendance).where(Attendance.academy_id == aid, Attendance.date == today))).scalar() or 0
    today_present = (await db.execute(select(func.count()).select_from(Attendance).where(Attendance.academy_id == aid, Attendance.date == today, Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE])))).scalar() or 0

    first_of_month = today.replace(day=1)
    m_total = (await db.execute(select(func.count()).select_from(Attendance).where(Attendance.academy_id == aid, Attendance.date >= first_of_month))).scalar() or 0
    m_present = (await db.execute(select(func.count()).select_from(Attendance).where(Attendance.academy_id == aid, Attendance.date >= first_of_month, Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE])))).scalar() or 0

    unpaid = (await db.execute(select(func.count(), func.coalesce(func.sum(Invoice.amount), 0)).select_from(Invoice).where(Invoice.academy_id == aid, Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE])))).one()

    return {
        "today_attendance": {"present": today_present, "total": today_total, "rate": round(today_present / today_total * 100, 1) if today_total else 0},
        "month_attendance_rate": round(m_present / m_total * 100, 1) if m_total else 0,
        "unpaid": {"count": unpaid[0], "amount": unpaid[1]},
    }


@router.get("/attendance-trend")
async def attendance_trend(
    months: int = 6,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    trends = []
    for i in range(months - 1, -1, -1):
        month_date = today.replace(day=1) - timedelta(days=30 * i)
        month_start = month_date.replace(day=1)
        from calendar import monthrange
        _, num_days = monthrange(month_start.year, month_start.month)
        month_end = month_start.replace(day=num_days)

        t = (await db.execute(select(func.count()).select_from(Attendance).where(Attendance.academy_id == membership.academy_id, Attendance.date >= month_start, Attendance.date <= month_end))).scalar() or 0
        p = (await db.execute(select(func.count()).select_from(Attendance).where(Attendance.academy_id == membership.academy_id, Attendance.date >= month_start, Attendance.date <= month_end, Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE])))).scalar() or 0
        trends.append({"month": month_start.strftime("%Y-%m"), "rate": round(p / t * 100, 1) if t else 0})
    return trends


@router.get("/at-risk")
async def at_risk_students(
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    thirty_days_ago = date.today() - timedelta(days=30)
    result = await db.execute(
        select(Attendance.student_id, func.count().label("total"),
               func.count().filter(Attendance.status.in_([AttendanceStatus.PRESENT, AttendanceStatus.LATE])).label("present"))
        .where(Attendance.academy_id == membership.academy_id, Attendance.date >= thirty_days_ago)
        .group_by(Attendance.student_id)
    )
    at_risk = []
    for row in result.all():
        rate = round(row.present / row.total * 100, 1) if row.total else 0
        if rate < 80:
            student = await db.get(Student, row.student_id)
            at_risk.append({"student_id": row.student_id, "student_name": student.name if student else "", "attendance_rate": rate})
    at_risk.sort(key=lambda x: x["attendance_rate"])
    return at_risk[:10]
