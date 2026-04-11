import urllib.parse
import secrets

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from authlib.integrations.httpx_client import AsyncOAuth2Client
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.auth import create_access_token, get_current_user
from app.models.user import User
from app.models.user_academy import UserAcademy, MemberRole
from app.models.invitation import Invitation
from app.models.academy import Academy
from app.models.student import Student
from app.models.classroom import Classroom, StudentClassroom

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google/login")
async def google_login(invite: str | None = None):
    """invite 파라미터가 있으면 redirect_uri에 포함"""
    redirect_uri = settings.GOOGLE_REDIRECT_URI
    if invite:
        redirect_uri += f"?invite={invite}"
    client = AsyncOAuth2Client(
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        redirect_uri=redirect_uri,
        scope="openid email profile",
    )
    uri, _ = client.create_authorization_url(GOOGLE_AUTH_URL)
    return {"url": uri}


@router.get("/google/callback")
async def google_callback(code: str, invite: str | None = None, db: AsyncSession = Depends(get_db)):
    redirect_uri = settings.GOOGLE_REDIRECT_URI
    if invite:
        redirect_uri += f"?invite={invite}"
    client = AsyncOAuth2Client(
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        redirect_uri=redirect_uri,
    )
    token = await client.fetch_token(GOOGLE_TOKEN_URL, code=code)
    resp = await client.get(GOOGLE_USERINFO_URL)
    userinfo = resp.json()

    email = userinfo.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")

    # Get or create user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(email=email, name=userinfo.get("name", ""), picture=userinfo.get("picture"))
        db.add(user)
        await db.flush()

    # Process invitations — by email or by invite code
    invite_code = invite if invite and len(invite) > 5 else None

    # Check email-based invitations
    inv_result = await db.execute(
        select(Invitation).where(Invitation.email == email, Invitation.used == False)
    )
    for inv in inv_result.scalars().all():
        existing = await db.execute(
            select(UserAcademy).where(UserAcademy.user_id == user.id, UserAcademy.academy_id == inv.academy_id)
        )
        if not existing.scalar_one_or_none():
            db.add(UserAcademy(user_id=user.id, academy_id=inv.academy_id, role=MemberRole(inv.role.value)))
        inv.used = True

    # Check invite code
    if invite_code:
        inv_result = await db.execute(
            select(Invitation).where(Invitation.invite_code == invite_code, Invitation.used == False)
        )
        inv = inv_result.scalar_one_or_none()
        if inv:
            existing = await db.execute(
                select(UserAcademy).where(UserAcademy.user_id == user.id, UserAcademy.academy_id == inv.academy_id)
            )
            if not existing.scalar_one_or_none():
                db.add(UserAcademy(user_id=user.id, academy_id=inv.academy_id, role=MemberRole(inv.role.value)))
            inv.used = True

    await db.commit()
    await db.refresh(user)

    # Get user's academies
    academies_result = await db.execute(
        select(UserAcademy).where(UserAcademy.user_id == user.id)
    )
    memberships = academies_result.scalars().all()

    access_token = create_access_token({"sub": user.id})
    params = urllib.parse.urlencode({
        "token": access_token,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "picture": user.picture or "",
        "academy_count": len(memberships),
        "academy_id": memberships[0].academy_id if len(memberships) == 1 else "",
        "role": memberships[0].role.value if len(memberships) == 1 else "",
    })
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/login/callback?{params}")


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
    }


@router.post("/quick-setup")
async def quick_setup(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """테스트용 — 실제 학원처럼 풍성한 데이터 세팅"""
    from datetime import date, timedelta
    from app.models.schedule import Schedule, DayOfWeek
    from app.models.attendance import Attendance, AttendanceStatus, AttendanceMethod
    from app.models.payment import Invoice, Payment, InvoiceStatus
    from app.models.counseling import Counseling
    import random

    academy = Academy(name="강남 매쓰킹 수학학원", address="서울시 강남구 대치동 123-45", phone="02-555-1234")
    db.add(academy)
    await db.flush()

    db.add(UserAcademy(user_id=user.id, academy_id=academy.id, role=MemberRole.OWNER))

    # ── 반 4개 ──────────────────────────────────────────
    classrooms_data = [
        ("중등수학 기초반", 280000),
        ("중등수학 심화반", 320000),
        ("고등수학 기초반", 350000),
        ("고등수학 심화반", 400000),
    ]
    classrooms = []
    for name, fee in classrooms_data:
        c = Classroom(name=name, monthly_fee=fee, academy_id=academy.id)
        db.add(c)
        classrooms.append(c)
    await db.flush()

    # ── 시간표 ───────────────────────────────────────────
    # 중등기초: 월수금 15:00~17:00
    # 중등심화: 화목 16:00~18:00
    # 고등기초: 월수금 17:00~19:00
    # 고등심화: 화목토 18:00~20:30
    schedule_data = [
        (classrooms[0], DayOfWeek.MON, "15:00", "17:00", "A실"),
        (classrooms[0], DayOfWeek.WED, "15:00", "17:00", "A실"),
        (classrooms[0], DayOfWeek.FRI, "15:00", "17:00", "A실"),
        (classrooms[1], DayOfWeek.TUE, "16:00", "18:00", "B실"),
        (classrooms[1], DayOfWeek.THU, "16:00", "18:00", "B실"),
        (classrooms[2], DayOfWeek.MON, "17:00", "19:00", "B실"),
        (classrooms[2], DayOfWeek.WED, "17:00", "19:00", "B실"),
        (classrooms[2], DayOfWeek.FRI, "17:00", "19:00", "B실"),
        (classrooms[3], DayOfWeek.TUE, "18:00", "20:30", "C실"),
        (classrooms[3], DayOfWeek.THU, "18:00", "20:30", "C실"),
        (classrooms[3], DayOfWeek.SAT, "10:00", "12:30", "C실"),
    ]
    from datetime import time as time_cls
    for cr, dow, st, et, room in schedule_data:
        sh, sm = map(int, st.split(":"))
        eh, em = map(int, et.split(":"))
        db.add(Schedule(
            classroom_id=cr.id, teacher_id=None, academy_id=academy.id,
            day_of_week=dow,
            start_time=time_cls(sh, sm),
            end_time=time_cls(eh, em),
            room=room,
        ))

    # ── 학생 15명 ────────────────────────────────────────
    students_data = [
        # (이름, 전화, 학교, 학년, 반index)
        ("김민준", "010-1001-0001", "대치중학교", "중1", 0),
        ("이서연", "010-1001-0002", "대치중학교", "중2", 0),
        ("박지호", "010-1001-0003", "은광중학교", "중2", 0),
        ("최유나", "010-1001-0004", "대치중학교", "중3", 1),
        ("정하준", "010-1001-0005", "은광중학교", "중3", 1),
        ("강소율", "010-1001-0006", "대치중학교", "중3", 1),
        ("윤재원", "010-1001-0007", "휘문고등학교", "고1", 2),
        ("임나영", "010-1001-0008", "단대부고", "고1", 2),
        ("한도현", "010-1001-0009", "휘문고등학교", "고1", 2),
        ("오세진", "010-1001-0010", "대원외고", "고2", 2),
        ("신예림", "010-1001-0011", "단대부고", "고2", 3),
        ("권민혁", "010-1001-0012", "휘문고등학교", "고2", 3),
        ("배수아", "010-1001-0013", "대원외고", "고3", 3),
        ("홍태양", "010-1001-0014", "단대부고", "고3", 3),
        ("문지아", "010-1001-0015", "휘문고등학교", "고3", 3),
    ]
    students = []
    for name, phone, school, grade, cr_idx in students_data:
        s = Student(
            name=name, phone=phone,
            parent_phone=f"010-2{phone[6:]}",
            parent_name=f"{name[0]}씨 학부모",
            school=school, grade=grade,
            qr_token=secrets.token_urlsafe(16),
            academy_id=academy.id,
        )
        db.add(s)
        students.append((s, cr_idx))
    await db.flush()

    # 반 배정
    for s, cr_idx in students:
        db.add(StudentClassroom(student_id=s.id, classroom_id=classrooms[cr_idx].id))
    await db.flush()

    # ── 출결 기록 (최근 30일) ────────────────────────────
    today = date.today()
    rng = random.Random(42)
    for s, cr_idx in students:
        for days_ago in range(1, 31):
            d = today - timedelta(days=days_ago)
            if d.weekday() >= 5:  # 주말 제외
                continue
            # 출석 확률: 대부분 출석, 일부 학생 결석 많음
            roll = rng.random()
            if s.name in ("홍태양", "권민혁"):  # 위험 학생
                status = AttendanceStatus.ABSENT if roll < 0.35 else AttendanceStatus.PRESENT
            elif s.name in ("배수아",):
                status = AttendanceStatus.LATE if roll < 0.2 else AttendanceStatus.PRESENT
            else:
                status = AttendanceStatus.ABSENT if roll < 0.07 else AttendanceStatus.PRESENT
            db.add(Attendance(
                student_id=s.id,
                classroom_id=classrooms[cr_idx].id,
                academy_id=academy.id,
                status=status,
                method=AttendanceMethod.MANUAL,
                date=d,
                session_id=None,
            ))

    # ── 납부 청구서 (이번달 + 지난달) ───────────────────
    for month_offset in [0, 1]:  # 0=이번달, 1=지난달
        if today.month - month_offset < 1:
            y, m = today.year - 1, today.month - month_offset + 12
        else:
            y, m = today.year, today.month - month_offset
        due = date(y, m, 25)
        for s, cr_idx in students:
            fee = classrooms_data[cr_idx][1]
            # 지난달은 전부 납부, 이번달은 일부 미납
            if month_offset == 1:
                status = InvoiceStatus.PAID
                paid_date = due - timedelta(days=rng.randint(1, 10))
            else:
                unpaid_names = {"홍태양", "권민혁", "오세진"}
                status = InvoiceStatus.PENDING if s.name in unpaid_names else InvoiceStatus.PAID
                paid_date = due - timedelta(days=rng.randint(1, 5)) if status == InvoiceStatus.PAID else None
            inv = Invoice(
                student_id=s.id,
                academy_id=academy.id,
                amount=fee,
                description=f"{y}년 {m}월 수강료",
                status=status,
                due_date=due,
                paid_date=paid_date,
            )
            db.add(inv)

    # ── 상담 기록 ────────────────────────────────────────
    counseling_data = [
        # (학생 인덱스, days_offset, type, status, issue)
        (3, -20, "regular", "completed", "중간고사 대비 진도 점검. 함수 단원 이해도 우수."),
        (10, -15, "retention", "completed", "출석률 저하 관련 학부모 상담. 개인 사정으로 일시적 결석 확인."),
        (13, -10, "regular", "completed", "수능 D-200 학습 계획 수립. 취약 단원: 확률과 통계."),
        (11, -5, "parent", "completed", "학습 태도 개선 요청. 수업 집중도 향상 방안 논의."),
        (0, 3, "regular", "scheduled", "1학기 중간고사 대비 상담 예정"),
        (6, 5, "regular", "scheduled", "고1 1학기 학습 방향 상담 예정"),
        (14, 7, "parent", "scheduled", "수능 전략 학부모 상담 예정"),
    ]
    for ci, days_offset, c_type, c_status, issue in counseling_data:
        s_obj = students[ci][0]  # (Student, cr_idx) 튜플에서 Student 추출
        db.add(Counseling(
            student_id=s_obj.id,
            teacher_id=user.id,
            academy_id=academy.id,
            date=today + timedelta(days=days_offset),
            counseling_type=c_type,
            status=c_status,
            issue=issue,
            title=None,
        ))

    await db.commit()
    return {
        "academy_id": academy.id,
        "message": "테스트 학원 세팅 완료",
        "summary": {
            "학원명": "강남 매쓰킹 수학학원",
            "반": 4,
            "학생": 15,
            "시간표": len(schedule_data),
            "출결기록": "최근 30일",
            "납부청구": "2개월치",
            "상담기록": len(counseling_data),
        }
    }


@router.post("/join/{invite_code}")
async def join_by_invite_code(
    invite_code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """초대 링크로 학원 가입"""
    result = await db.execute(
        select(Invitation).where(Invitation.invite_code == invite_code, Invitation.used == False)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="유효하지 않은 초대 코드입니다")

    existing = await db.execute(
        select(UserAcademy).where(UserAcademy.user_id == user.id, UserAcademy.academy_id == inv.academy_id)
    )
    if existing.scalar_one_or_none():
        return {"ok": True, "message": "이미 가입된 학원입니다", "academy_id": inv.academy_id}

    db.add(UserAcademy(user_id=user.id, academy_id=inv.academy_id, role=MemberRole(inv.role.value)))
    inv.used = True
    await db.commit()

    academy = await db.get(Academy, inv.academy_id)
    return {"ok": True, "academy_id": inv.academy_id, "academy_name": academy.name if academy else "", "role": inv.role.value}
