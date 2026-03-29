from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user, require_owner
from app.models.user import User
from app.models.academy import Academy

router = APIRouter()


class AcademyCreate(BaseModel):
    name: str
    address: str | None = None
    address_detail: str | None = None
    phone: str | None = None
    bank_name: str | None = None
    bank_account: str | None = None
    bank_holder: str | None = None


class AcademyUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    address_detail: str | None = None
    phone: str | None = None
    bank_name: str | None = None
    bank_account: str | None = None
    bank_holder: str | None = None


@router.post("")
async def create_academy(
    data: AcademyCreate,
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    if user.academy_id:
        raise HTTPException(status_code=400, detail="이미 학원이 등록되어 있습니다")

    academy = Academy(**data.model_dump())
    db.add(academy)
    await db.flush()

    user.academy_id = academy.id
    await db.commit()
    await db.refresh(academy)

    return academy


@router.get("")
async def get_academy(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.academy_id:
        raise HTTPException(status_code=404, detail="등록된 학원이 없습니다")

    academy = await db.get(Academy, user.academy_id)
    return academy


@router.patch("")
async def update_academy(
    data: AcademyUpdate,
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    if not user.academy_id:
        raise HTTPException(status_code=404, detail="등록된 학원이 없습니다")

    academy = await db.get(Academy, user.academy_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(academy, key, value)

    await db.commit()
    await db.refresh(academy)
    return academy
