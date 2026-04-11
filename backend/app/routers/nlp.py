"""
자연어 명령 처리 엔드포인트
POST /api/nlp  { "text": "오늘 김민수 결석 처리해줘" }
"""
from datetime import date as date_cls

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user, get_membership
from app.core.nlp_parser import parse
from app.models.user import User
from app.models.user_academy import UserAcademy
from app.models.student import Student
from app.models.classroom import Classroom, StudentClassroom
from app.models.attendance import Attendance, AttendanceStatus, AttendanceMethod
from app.models.payment import Invoice, InvoiceStatus
from app.models.counseling import Counseling

router = APIRouter()


class NLPRequest(BaseModel):
    text: str


# ── 실행기들 ──────────────────────────────────────────────

async def _resolve_student(name: str, academy_id: int, db: AsyncSession) -> Student | None:
    result = await db.execute(
        select(Student).where(Student.academy_id == academy_id, Student.name == name)
    )
    return result.scalar_one_or_none()


async def _get_all_names(academy_id: int, db: AsyncSession):
    students = await db.execute(select(Student.name).where(Student.academy_id == academy_id))
    classrooms = await db.execute(select(Classroom.name).where(Classroom.academy_id == academy_id))
    return (
        [r[0] for r in students.all()],
        [r[0] for r in classrooms.all()],
    )


async def execute_attendance_set(params: dict, academy_id: int, user_id: int, db: AsyncSession) -> dict:
    student_name = params.get("student_name")
    if not student_name:
        return {"ok": False, "message": "학생 이름을 알 수 없습니다. 예: '김민수 결석 처리해줘'"}

    student = await _resolve_student(student_name, academy_id, db)
    if not student:
        return {"ok": False, "message": f"'{student_name}' 학생을 찾을 수 없습니다."}

    target_date = date_cls.fromisoformat(params.get("date", date_cls.today().isoformat()))
    status_str = params.get("status", "absent")
    status = AttendanceStatus(status_str)

    # 기존 기록 확인
    existing = await db.execute(
        select(Attendance).where(
            Attendance.student_id == student.id,
            Attendance.date == target_date,
        )
    )
    att = existing.scalar_one_or_none()

    status_label = {"present": "출석", "absent": "결석", "late": "지각", "early_leave": "조퇴"}

    if att:
        att.status = status
        att.method = AttendanceMethod.MANUAL
    else:
        # 반 찾기
        enrolled = await db.execute(
            select(StudentClassroom.classroom_id).where(StudentClassroom.student_id == student.id)
        )
        row = enrolled.first()
        classroom_id = row[0] if row else None

        db.add(Attendance(
            student_id=student.id,
            session_id=None,
            classroom_id=classroom_id,
            academy_id=academy_id,
            status=status,
            method=AttendanceMethod.MANUAL,
            date=target_date,
        ))

    await db.commit()
    date_label = "오늘" if target_date == date_cls.today() else str(target_date)
    return {"ok": True, "message": f"{student.name} 학생 {date_label} {status_label.get(status_str, status_str)} 처리했습니다."}


async def execute_attendance_query(params: dict, academy_id: int, db: AsyncSession) -> dict:
    target_date = date_cls.fromisoformat(params.get("date", date_cls.today().isoformat()))

    query = select(Attendance, Student).join(Student, Attendance.student_id == Student.id).where(
        Attendance.academy_id == academy_id,
        Attendance.date == target_date,
    )

    classroom_name = params.get("classroom_name")
    if classroom_name:
        cr = await db.execute(select(Classroom).where(Classroom.academy_id == academy_id, Classroom.name == classroom_name))
        cr_obj = cr.scalar_one_or_none()
        if cr_obj:
            query = query.where(Attendance.classroom_id == cr_obj.id)

    result = await db.execute(query)
    rows = result.all()

    status_label = {"present": "출석", "absent": "결석", "late": "지각", "early_leave": "조퇴"}
    by_status: dict[str, list[str]] = {"present": [], "absent": [], "late": [], "early_leave": []}
    for att, stu in rows:
        by_status[att.status.value].append(stu.name)

    date_label = "오늘" if target_date == date_cls.today() else str(target_date)
    parts = []
    if by_status["absent"]:
        parts.append(f"결석 {len(by_status['absent'])}명: {', '.join(by_status['absent'])}")
    if by_status["late"]:
        parts.append(f"지각 {len(by_status['late'])}명: {', '.join(by_status['late'])}")
    if by_status["early_leave"]:
        parts.append(f"조퇴 {len(by_status['early_leave'])}명: {', '.join(by_status['early_leave'])}")
    if by_status["present"]:
        parts.append(f"출석 {len(by_status['present'])}명")

    if not parts:
        message = f"{date_label} 출결 기록이 없습니다."
    else:
        message = f"{date_label} 출결 현황 — " + " / ".join(parts)

    return {"ok": True, "message": message, "data": by_status}


async def execute_payment_query(params: dict, academy_id: int, db: AsyncSession) -> dict:
    today = date_cls.today()
    year = params.get("year", today.year)
    month = params.get("month", today.month)

    from calendar import monthrange
    first = date_cls(year, month, 1)
    last = date_cls(year, month, monthrange(year, month)[1])

    query = select(Invoice, Student).join(Student, Invoice.student_id == Student.id).where(
        Invoice.academy_id == academy_id,
        Invoice.due_date >= first,
        Invoice.due_date <= last,
        Invoice.status == InvoiceStatus.PENDING,
    )

    classroom_name = params.get("classroom_name")
    if classroom_name:
        cr = await db.execute(select(Classroom).where(Classroom.academy_id == academy_id, Classroom.name == classroom_name))
        cr_obj = cr.scalar_one_or_none()
        if cr_obj:
            enrolled = await db.execute(
                select(StudentClassroom.student_id).where(StudentClassroom.classroom_id == cr_obj.id)
            )
            ids = [r[0] for r in enrolled.all()]
            query = query.where(Invoice.student_id.in_(ids))

    result = await db.execute(query)
    rows = result.all()

    names = [stu.name for _, stu in rows]
    total = sum(inv.amount for inv, _ in rows)

    month_label = f"{year}년 {month}월"
    if not names:
        return {"ok": True, "message": f"{month_label} 미납자가 없습니다."}

    return {
        "ok": True,
        "message": f"{month_label} 미납 {len(names)}명 (총 {total:,}원): {', '.join(names)}",
        "data": {"students": names, "total": total},
    }


async def execute_payment_set(params: dict, academy_id: int, db: AsyncSession) -> dict:
    student_name = params.get("student_name")
    if not student_name:
        return {"ok": False, "message": "학생 이름을 알 수 없습니다."}

    student = await _resolve_student(student_name, academy_id, db)
    if not student:
        return {"ok": False, "message": f"'{student_name}' 학생을 찾을 수 없습니다."}

    today = date_cls.today()
    year = params.get("year", today.year)
    month = params.get("month", today.month)

    from calendar import monthrange
    first = date_cls(year, month, 1)
    last = date_cls(year, month, monthrange(year, month)[1])

    result = await db.execute(
        select(Invoice).where(
            Invoice.student_id == student.id,
            Invoice.academy_id == academy_id,
            Invoice.due_date >= first,
            Invoice.due_date <= last,
            Invoice.status == InvoiceStatus.PENDING,
        )
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        return {"ok": False, "message": f"{student.name} 학생의 {year}년 {month}월 미납 청구서가 없습니다."}

    invoice.status = InvoiceStatus.PAID
    invoice.paid_date = today
    await db.commit()

    return {"ok": True, "message": f"{student.name} 학생 {year}년 {month}월 납부 완료 처리했습니다."}


async def execute_counseling_query(params: dict, academy_id: int, db: AsyncSession) -> dict:
    today = date_cls.today()
    result = await db.execute(
        select(Counseling, Student)
        .join(Student, Counseling.student_id == Student.id)
        .where(
            Counseling.academy_id == academy_id,
            Counseling.status == "scheduled",
            Counseling.date >= today,
        )
        .order_by(Counseling.date)
        .limit(10)
    )
    rows = result.all()
    if not rows:
        return {"ok": True, "message": "예정된 상담이 없습니다."}

    items = [f"{stu.name}({c.date})" for c, stu in rows]
    return {"ok": True, "message": f"예정 상담 {len(items)}건: {', '.join(items)}"}


async def execute_student_create(params: dict, academy_id: int, db: AsyncSession) -> dict:
    student_name = params.get("student_name")
    if not student_name:
        return {"ok": False, "message": "추가할 학생 이름을 알 수 없습니다. 예: '김기현 추가해줘'"}

    # 중복 확인
    existing = await db.execute(
        select(Student).where(Student.academy_id == academy_id, Student.name == student_name)
    )
    if existing.scalar_one_or_none():
        return {"ok": False, "message": f"'{student_name}' 학생이 이미 등록되어 있습니다."}

    # 바로 등록하지 않고 추가 정보 요청
    return {
        "ok": "pending",
        "message": f"'{student_name}' 학생을 등록할게요.\n학년과 연락처를 알려주세요.\n예) 고2, 010-1234-5678",
        "action": "ask_student_info",
        "student_name": student_name,
    }


async def execute_student_query(params: dict, academy_id: int, db: AsyncSession) -> dict:
    student_name = params.get("student_name")

    if student_name:
        student = await _resolve_student(student_name, academy_id, db)
        if not student:
            return {"ok": False, "message": f"'{student_name}' 학생을 찾을 수 없습니다."}
        info = f"{student.name} / {student.school or '-'} {student.grade or '-'} / 학생: {student.phone or '-'} / 학부모: {student.parent_name or '-'} {student.parent_phone or '-'}"
        return {"ok": True, "message": info}

    # 전체 학생 수
    result = await db.execute(select(Student).where(Student.academy_id == academy_id))
    students = result.scalars().all()
    return {"ok": True, "message": f"현재 재원생 총 {len(students)}명입니다.", "data": {"count": len(students)}}


# ── 메인 엔드포인트 ───────────────────────────────────────

INTENT_HELP = {
    "attendance_set":    "예: '오늘 김민수 결석', '박철수 지각 처리해줘'",
    "attendance_query":  "예: '오늘 출석 현황', '이번주 결석자 알려줘'",
    "payment_set":       "예: '김민수 이번달 납부 완료', '이지연 수납 처리'",
    "payment_query":     "예: '이번달 미납자', '중등수학A 납부 현황'",
    "counseling_query":  "예: '이번주 상담 일정', '예정된 상담 알려줘'",
    "student_query":     "예: '김민수 연락처', '재원생 몇 명이야'",
}

QUICK_CHIPS = [
    "오늘 출석 현황",
    "이번달 미납자",
    "예정된 상담",
    "재원생 몇 명?",
]


@router.post("")
async def nlp_command(
    req: NLPRequest,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    text = req.text.strip()
    if not text:
        return {"ok": False, "message": "명령어를 입력해주세요.", "chips": QUICK_CHIPS}

    academy_id = membership.academy_id
    student_names, classroom_names = await _get_all_names(academy_id, db)

    parsed = parse(text, student_names, classroom_names)

    if not parsed:
        return {
            "ok": False,
            "message": f"'{text}'을(를) 이해하지 못했습니다.",
            "hint": "출결, 납부, 상담, 학생 관련 명령을 입력해보세요.",
            "chips": QUICK_CHIPS,
        }

    intent = parsed.intent
    params = parsed.params

    # 신뢰도 낮으면 확인 요청
    if parsed.confidence == "low":
        hint = INTENT_HELP.get(intent, "")
        return {
            "ok": False,
            "message": f"명령을 이해했지만 정보가 부족합니다.",
            "hint": hint,
            "chips": QUICK_CHIPS,
        }

    # 실행
    if intent == "student_create":
        result = await execute_student_create(params, academy_id, db)
    elif intent == "attendance_set":
        result = await execute_attendance_set(params, academy_id, membership.user_id, db)
    elif intent == "attendance_query":
        result = await execute_attendance_query(params, academy_id, db)
    elif intent == "payment_set":
        result = await execute_payment_set(params, academy_id, db)
    elif intent == "payment_query":
        result = await execute_payment_query(params, academy_id, db)
    elif intent == "counseling_query":
        result = await execute_counseling_query(params, academy_id, db)
    elif intent == "counseling_create":
        result = {"ok": False, "message": "상담 예약은 상담일지 페이지에서 진행해주세요.", "hint": "날짜·유형 입력이 필요합니다."}
    elif intent == "student_query":
        result = await execute_student_query(params, academy_id, db)
    else:
        result = {"ok": False, "message": "아직 지원하지 않는 명령입니다."}

    return {**result, "intent": intent, "chips": QUICK_CHIPS}


@router.get("/hints")
async def nlp_hints():
    """사용 가이드 전체 반환"""
    return {
        "categories": [
            {
                "name": "출결",
                "examples": [
                    "오늘 김민수 결석",
                    "박철수 지각 처리해줘",
                    "이지연 오늘 조퇴",
                    "오늘 출석 현황",
                    "이번주 결석자 알려줘",
                ]
            },
            {
                "name": "납부",
                "examples": [
                    "김민수 이번달 납부 완료",
                    "이번달 미납자 목록",
                    "중등수학A 납부 현황",
                    "3월 미납자 알려줘",
                ]
            },
            {
                "name": "상담",
                "examples": [
                    "예정된 상담 알려줘",
                    "이번주 상담 일정",
                ]
            },
            {
                "name": "학생",
                "examples": [
                    "김민수 연락처",
                    "재원생 몇 명이야",
                    "이지연 학부모 번호",
                ]
            },
        ]
    }
