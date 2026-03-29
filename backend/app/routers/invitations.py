from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import require_owner
from app.models.user import User
from app.models.invitation import Invitation, InviteRole

router = APIRouter()


class InviteCreate(BaseModel):
    email: str
    role: InviteRole


@router.get("")
async def list_invitations(
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invitation).where(Invitation.academy_id == user.academy_id)
    )
    return [
        {
            "id": inv.id,
            "email": inv.email,
            "role": inv.role.value,
            "used": inv.used,
            "created_at": inv.created_at.isoformat(),
        }
        for inv in result.scalars().all()
    ]


@router.post("")
async def create_invitation(
    data: InviteCreate,
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    # Check if already invited
    existing = await db.execute(
        select(Invitation).where(
            Invitation.email == data.email,
            Invitation.academy_id == user.academy_id,
            Invitation.used == False,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="이미 초대된 이메일입니다")

    invitation = Invitation(
        email=data.email,
        role=data.role,
        academy_id=user.academy_id,
        invited_by=user.id,
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    return {"id": invitation.id, "email": invitation.email, "role": invitation.role.value}


@router.delete("/{invitation_id}")
async def delete_invitation(
    invitation_id: int,
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    invitation = await db.get(Invitation, invitation_id)
    if not invitation or invitation.academy_id != user.academy_id:
        raise HTTPException(status_code=404)

    await db.delete(invitation)
    await db.commit()
    return {"ok": True}
