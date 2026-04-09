from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.user_academy import UserAcademy, MemberRole

security = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    to_encode["sub"] = str(to_encode["sub"])
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No token provided")

    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: no sub")
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_academy_id(
    x_academy_id: str | None = Header(None),
) -> int:
    """요청 헤더에서 현재 선택된 학원 ID를 읽는다."""
    if not x_academy_id:
        raise HTTPException(status_code=400, detail="X-Academy-Id 헤더가 필요합니다")
    return int(x_academy_id)


async def get_membership(
    user: User = Depends(get_current_user),
    academy_id: int = Depends(get_academy_id),
    db: AsyncSession = Depends(get_db),
) -> UserAcademy:
    """현재 유저가 해당 학원에 소속돼 있는지 확인하고 UserAcademy 반환."""
    result = await db.execute(
        select(UserAcademy).where(
            UserAcademy.user_id == user.id,
            UserAcademy.academy_id == academy_id,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 학원에 접근 권한이 없습니다")
    return membership


async def require_owner(
    membership: UserAcademy = Depends(get_membership),
) -> UserAcademy:
    if membership.role != MemberRole.OWNER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="원장 권한이 필요합니다")
    return membership
