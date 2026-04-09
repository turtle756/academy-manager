from datetime import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_membership
from app.models.user_academy import UserAcademy
from app.models.schedule import Schedule, DayOfWeek

router = APIRouter()


class ScheduleCreate(BaseModel):
    classroom_id: int
    teacher_id: int | None = None
    day_of_week: DayOfWeek
    start_time: str
    end_time: str
    room: str | None = None


def parse_time(t: str) -> time:
    parts = t.split(":")
    return time(int(parts[0]), int(parts[1]))


@router.get("")
async def list_schedules(
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Schedule)
        .where(Schedule.academy_id == membership.academy_id)
        .options(selectinload(Schedule.classroom), selectinload(Schedule.teacher))
    )
    return [
        {
            "id": s.id, "classroom_id": s.classroom_id,
            "classroom_name": s.classroom.name if s.classroom else None,
            "teacher_id": s.teacher_id,
            "teacher_name": s.teacher.name if s.teacher else None,
            "day_of_week": s.day_of_week.value,
            "start_time": s.start_time.strftime("%H:%M"),
            "end_time": s.end_time.strftime("%H:%M"),
            "room": s.room,
        }
        for s in result.scalars().all()
    ]


@router.post("")
async def create_schedule(
    data: ScheduleCreate,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    schedule = Schedule(
        classroom_id=data.classroom_id, teacher_id=data.teacher_id,
        academy_id=membership.academy_id, day_of_week=data.day_of_week,
        start_time=parse_time(data.start_time), end_time=parse_time(data.end_time),
        room=data.room,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    schedule = await db.get(Schedule, schedule_id)
    if not schedule or schedule.academy_id != membership.academy_id:
        raise HTTPException(status_code=404)
    await db.delete(schedule)
    await db.commit()
    return {"ok": True}
