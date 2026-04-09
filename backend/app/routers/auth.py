import urllib.parse

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from authlib.integrations.httpx_client import AsyncOAuth2Client
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.auth import create_access_token, get_current_user
from app.models.user import User, UserRole
from app.models.invitation import Invitation

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google/login")
async def google_login():
    client = AsyncOAuth2Client(
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
        scope="openid email profile",
    )
    uri, _ = client.create_authorization_url(GOOGLE_AUTH_URL)
    return {"url": uri}


@router.get("/google/callback")
async def google_callback(code: str, db: AsyncSession = Depends(get_db)):
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

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        # Check if there's a pending invitation for this email
        inv_result = await db.execute(
            select(Invitation).where(
                Invitation.email == email,
                Invitation.used == False,
            )
        )
        invitation = inv_result.scalar_one_or_none()

        if invitation:
            user = User(
                email=email,
                name=userinfo.get("name", ""),
                picture=userinfo.get("picture"),
                role=UserRole(invitation.role.value),
                academy_id=invitation.academy_id,
            )
            invitation.used = True
        else:
            user = User(
                email=email,
                name=userinfo.get("name", ""),
                picture=userinfo.get("picture"),
                role=UserRole.OWNER,
            )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token = create_access_token({"sub": user.id})
    # Redirect to frontend with token in URL fragment
    params = urllib.parse.urlencode({
        "token": access_token,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "academy_id": user.academy_id or "",
        "picture": user.picture or "",
    })
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/login/callback?{params}")


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "role": user.role.value,
        "academy_id": user.academy_id,
    }


@router.post("/quick-setup")
async def quick_setup(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """테스트용 — 학원 + 원생 1명 즉시 생성"""
    from app.models.academy import Academy
    from app.models.student import Student
    import secrets, random, string

    if user.academy_id:
        academy = await db.get(Academy, user.academy_id)
    else:
        academy = Academy(name="테스트 학원", address="서울시 강남구 테헤란로 1", phone="02-1234-5678")
        db.add(academy)
        await db.flush()
        user.academy_id = academy.id

    # 테스트 원생 추가
    student = Student(
        name="테스트 학생",
        phone="010-0000-0001",
        parent_phone="010-0000-0002",
        parent_name="테스트 학부모",
        pin_code="".join(random.choices(string.digits, k=4)),
        qr_token=secrets.token_urlsafe(16),
        academy_id=academy.id,
    )
    db.add(student)
    await db.commit()
    await db.refresh(user)
    await db.refresh(student)

    return {
        "academy_id": academy.id,
        "student": {"id": student.id, "name": student.name, "pin_code": student.pin_code},
        "message": "테스트 세팅 완료",
    }
