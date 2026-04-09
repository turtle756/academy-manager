import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user, require_owner
from app.models.user import User
from app.models.user_academy import UserAcademy
from app.models.invitation import Invitation, InviteRole

router = APIRouter()


class InviteCreate(BaseModel):
    email: str | None = None  # email 직접 입력 or None이면 링크 생성
    role: InviteRole


@router.get("")
async def list_invitations(
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invitation).where(Invitation.academy_id == membership.academy_id)
    )
    return [
        {"id": inv.id, "email": inv.email, "role": inv.role.value,
         "used": inv.used, "invite_code": inv.invite_code,
         "created_at": inv.created_at.isoformat()}
        for inv in result.scalars().all()
    ]


@router.post("")
async def create_invitation(
    data: InviteCreate,
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    if data.email:
        existing = await db.execute(
            select(Invitation).where(
                Invitation.email == data.email,
                Invitation.academy_id == membership.academy_id,
                Invitation.used == False,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="이미 초대된 이메일입니다")

    invite_code = secrets.token_urlsafe(12)
    invitation = Invitation(
        email=data.email,
        role=data.role,
        academy_id=membership.academy_id,
        invited_by=membership.user_id,
        invite_code=invite_code,
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    return {"id": invitation.id, "email": invitation.email, "role": invitation.role.value, "invite_code": invite_code}


@router.delete("/{invitation_id}")
async def delete_invitation(
    invitation_id: int,
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    invitation = await db.get(Invitation, invitation_id)
    if not invitation or invitation.academy_id != membership.academy_id:
        raise HTTPException(status_code=404)
    await db.delete(invitation)
    await db.commit()
    return {"ok": True}
