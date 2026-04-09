import urllib.parse
import random
import string
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

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google/login")
async def google_login(invite: str | None = None):
    """invite 파라미터가 있으면 state에 포함시켜서 콜백에서 처리"""
    client = AsyncOAuth2Client(
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
        scope="openid email profile",
    )
    state = invite or ""
    uri, _ = client.create_authorization_url(GOOGLE_AUTH_URL, state=state)
    return {"url": uri}


@router.get("/google/callback")
async def google_callback(code: str, state: str = "", db: AsyncSession = Depends(get_db)):
    client = AsyncOAuth2Client(
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
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

    # Process invitations — by email or by invite code (state)
    invite_code = state if state and len(state) > 5 else None

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
    """테스트용 — 학원 + 원생 즉시 생성 + 유저를 원장으로 배정"""
    academy = Academy(name="테스트 학원", address="서울시 강남구 테헤란로 1", phone="02-1234-5678")
    db.add(academy)
    await db.flush()

    # 유저를 원장으로 배정
    db.add(UserAcademy(user_id=user.id, academy_id=academy.id, role=MemberRole.OWNER))

    # 테스트 원생 5명 추가
    test_students = [
        ("김민수", "010-1111-0001", "중1"),
        ("이영희", "010-1111-0002", "중2"),
        ("박철수", "010-1111-0003", "중3"),
        ("정수진", "010-1111-0004", "고1"),
        ("홍길동", "010-1111-0005", "고2"),
    ]
    for name, phone, grade in test_students:
        db.add(Student(
            name=name, phone=phone, parent_phone=f"010-2222-{phone[-4:]}",
            parent_name=f"{name} 학부모", school="테스트학교", grade=grade,
            pin_code="".join(random.choices(string.digits, k=4)),
            qr_token=secrets.token_urlsafe(16),
            academy_id=academy.id,
        ))

    await db.commit()
    return {"academy_id": academy.id, "message": "테스트 학원 + 원생 5명 생성 완료"}


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
