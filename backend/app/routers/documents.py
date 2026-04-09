import io
from datetime import date
from calendar import monthrange

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import require_owner
from app.models.user_academy import UserAcademy
from app.models.student import Student
from app.models.classroom import Classroom, StudentClassroom
from app.models.attendance import Attendance, AttendanceStatus

router = APIRouter()


@router.get("/attendance-sheet")
async def generate_attendance_sheet(
    classroom_id: int, month: str,
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    year, m = month.split("-")
    start = date(int(year), int(m), 1)
    _, num_days = monthrange(int(year), int(m))
    days = [date(int(year), int(m), d) for d in range(1, num_days + 1)]
    if int(m) == 12: end = date(int(year) + 1, 1, 1)
    else: end = date(int(year), int(m) + 1, 1)

    classroom = await db.get(Classroom, classroom_id)
    result = await db.execute(select(StudentClassroom).where(StudentClassroom.classroom_id == classroom_id).options(selectinload(StudentClassroom.student)))
    students = [sc.student for sc in result.scalars().all()]

    att_result = await db.execute(select(Attendance).where(Attendance.classroom_id == classroom_id, Attendance.academy_id == membership.academy_id, Attendance.date >= start, Attendance.date < end))
    att_map = {(a.student_id, a.date): a.status for a in att_result.scalars().all()}

    status_map = {AttendanceStatus.PRESENT: "O", AttendanceStatus.LATE: "△", AttendanceStatus.ABSENT: "X", AttendanceStatus.EARLY_LEAVE: "▽"}

    wb = Workbook()
    ws = wb.active
    ws.title = f"출석부 {month}"
    ws.append([f"출석부 - {classroom.name if classroom else ''} ({month})"])
    ws.append(["번호", "이름"] + [str(d.day) for d in days] + ["출석", "지각", "결석", "출석률"])

    for idx, student in enumerate(students, 1):
        row = [idx, student.name]
        present = late = absent = 0
        for day in days:
            s = att_map.get((student.id, day))
            row.append(status_map.get(s, "") if s else "")
            if s == AttendanceStatus.PRESENT: present += 1
            elif s == AttendanceStatus.LATE: late += 1
            elif s == AttendanceStatus.ABSENT: absent += 1
        total = present + late + absent
        row.extend([present, late, absent, f"{round((present + late) / total * 100, 1)}%" if total else "0%"])
        ws.append(row)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f"attachment; filename=출석부_{month}.xlsx"})


@router.get("/student-roster")
async def generate_student_roster(
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Student).where(Student.academy_id == membership.academy_id).options(selectinload(Student.classrooms).selectinload(StudentClassroom.classroom)))
    students = result.scalars().all()

    wb = Workbook()
    ws = wb.active
    ws.title = "수강생 대장"
    ws.append(["수강생 대장"])
    ws.append(["번호", "이름", "학교", "학년", "연락처", "학부모", "학부모 연락처", "수강 반", "등록일"])
    for idx, s in enumerate(students, 1):
        classrooms = ", ".join(sc.classroom.name for sc in s.classrooms if sc.classroom)
        ws.append([idx, s.name, s.school or "", s.grade or "", s.phone or "", s.parent_name or "", s.parent_phone or "", classrooms, str(s.created_at.date()) if s.created_at else ""])

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=수강생대장.xlsx"})
