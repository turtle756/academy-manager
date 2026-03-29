import io
from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user, require_owner
from app.models.user import User
from app.models.student import Student
from app.models.classroom import Classroom, StudentClassroom
from app.models.attendance import Attendance, AttendanceStatus

router = APIRouter()


@router.get("/attendance-sheet")
async def generate_attendance_sheet(
    classroom_id: int,
    month: str,  # "2026-03"
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    year, m = month.split("-")
    start = date(int(year), int(m), 1)
    if int(m) == 12:
        end = date(int(year) + 1, 1, 1)
    else:
        end = date(int(year), int(m) + 1, 1)

    # Get classroom info
    classroom = await db.get(Classroom, classroom_id)

    # Get students in classroom
    result = await db.execute(
        select(StudentClassroom)
        .where(StudentClassroom.classroom_id == classroom_id)
        .options(selectinload(StudentClassroom.student))
    )
    student_classrooms = result.scalars().all()
    students = [sc.student for sc in student_classrooms]

    # Get attendance records
    att_result = await db.execute(
        select(Attendance).where(
            Attendance.classroom_id == classroom_id,
            Attendance.academy_id == user.academy_id,
            Attendance.date >= start,
            Attendance.date < end,
        )
    )
    attendances = att_result.scalars().all()

    # Build attendance map: {(student_id, date): status}
    att_map = {}
    for a in attendances:
        att_map[(a.student_id, a.date)] = a.status

    # Generate days in month
    days = []
    current = start
    while current < end:
        days.append(current)
        current = date(current.year, current.month, current.day + 1) if current.day < 28 else current.replace(day=current.day + 1) if current < end else end

    # Recalculate days properly
    from calendar import monthrange
    _, num_days = monthrange(int(year), int(m))
    days = [date(int(year), int(m), d) for d in range(1, num_days + 1)]

    # Create Excel
    wb = Workbook()
    ws = wb.active
    ws.title = f"출석부 {month}"

    # Header
    ws.append([f"출석부 - {classroom.name if classroom else ''} ({month})"])
    headers = ["번호", "이름"] + [str(d.day) for d in days] + ["출석", "지각", "결석", "출석률"]
    ws.append(headers)

    status_map = {
        AttendanceStatus.PRESENT: "O",
        AttendanceStatus.LATE: "△",
        AttendanceStatus.ABSENT: "X",
        AttendanceStatus.EARLY_LEAVE: "▽",
    }

    for idx, student in enumerate(students, 1):
        row = [idx, student.name]
        present = late = absent = 0
        for day in days:
            status = att_map.get((student.id, day))
            if status:
                row.append(status_map.get(status, ""))
                if status == AttendanceStatus.PRESENT:
                    present += 1
                elif status == AttendanceStatus.LATE:
                    late += 1
                elif status == AttendanceStatus.ABSENT:
                    absent += 1
            else:
                row.append("")
        total = present + late + absent
        rate = round((present + late) / total * 100, 1) if total > 0 else 0
        row.extend([present, late, absent, f"{rate}%"])
        ws.append(row)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"출석부_{classroom.name if classroom else ''}_{month}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/student-roster")
async def generate_student_roster(
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Student)
        .where(Student.academy_id == user.academy_id)
        .options(selectinload(Student.classrooms).selectinload(StudentClassroom.classroom))
    )
    students = result.scalars().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "수강생 대장"

    ws.append(["수강생 대장"])
    ws.append(["번호", "이름", "학교", "학년", "연락처", "학부모", "학부모 연락처", "수강 반", "등록일"])

    for idx, s in enumerate(students, 1):
        classrooms = ", ".join(sc.classroom.name for sc in s.classrooms if sc.classroom)
        ws.append([
            idx, s.name, s.school or "", s.grade or "",
            s.phone or "", s.parent_name or "", s.parent_phone or "",
            classrooms, str(s.created_at.date()) if s.created_at else "",
        ])

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=수강생대장.xlsx"},
    )
