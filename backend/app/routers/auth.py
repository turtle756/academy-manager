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
