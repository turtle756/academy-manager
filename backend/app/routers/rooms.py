from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_membership
from app.models.user_academy import UserAcademy
from app.models.room import Room

router = APIRouter()


class RoomCreate(BaseModel):
    name: str


@router.get("")
async def list_rooms(
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Room).where(Room.academy_id == membership.academy_id).order_by(Room.id)
    )
    return result.scalars().all()


@router.post("")
async def create_room(
    data: RoomCreate,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    room = Room(name=data.name, academy_id=membership.academy_id)
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return room


@router.delete("/{room_id}")
async def delete_room(
    room_id: int,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    room = await db.get(Room, room_id)
    if not room or room.academy_id != membership.academy_id:
        raise HTTPException(status_code=404)
    await db.delete(room)
    await db.commit()
    return {"ok": True}
