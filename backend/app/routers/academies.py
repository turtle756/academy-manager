from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user, get_membership, require_owner
from app.models.user import User
from app.models.user_academy import UserAcademy
from app.models.academy import Academy

router = APIRouter()


class AcademyUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    address_detail: str | None = None
    phone: str | None = None
    bank_name: str | None = None
    bank_account: str | None = None
    bank_holder: str | None = None


@router.get("")
async def get_academy(
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    academy = await db.get(Academy, membership.academy_id)
    return academy


@router.get("/my")
async def list_my_academies(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내가 소속된 학원 목록"""
    result = await db.execute(
        select(UserAcademy, Academy)
        .join(Academy, UserAcademy.academy_id == Academy.id)
        .where(UserAcademy.user_id == user.id)
    )
    return [
        {
            "academy_id": ua.academy_id,
            "name": academy.name,
            "role": ua.role.value,
            "joined_at": ua.joined_at.isoformat() if ua.joined_at else None,
        }
        for ua, academy in result.all()
    ]


@router.patch("")
async def update_academy(
    data: AcademyUpdate,
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    academy = await db.get(Academy, membership.academy_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(academy, key, value)

    await db.commit()
    await db.refresh(academy)
    return academy
