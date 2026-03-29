from datetime import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.schedule import Schedule, DayOfWeek

router = APIRouter()


class ScheduleCreate(BaseModel):
    classroom_id: int
    teacher_id: int | None = None
    day_of_week: DayOfWeek
    start_time: str  # "14:00"
    end_time: str  # "16:00"
    room: str | None = None


class ScheduleUpdate(BaseModel):
    classroom_id: int | None = None
    teacher_id: int | None = None
    day_of_week: DayOfWeek | None = None
    start_time: str | None = None
    end_time: str | None = None
    room: str | None = None


def parse_time(t: str) -> time:
    parts = t.split(":")
    return time(int(parts[0]), int(parts[1]))


@router.get("")
async def list_schedules(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Schedule)
        .where(Schedule.academy_id == user.academy_id)
        .options(selectinload(Schedule.classroom), selectinload(Schedule.teacher))
    )
    schedules = result.scalars().all()
    return [
        {
            "id": s.id,
            "classroom_id": s.classroom_id,
            "classroom_name": s.classroom.name if s.classroom else None,
            "teacher_id": s.teacher_id,
            "teacher_name": s.teacher.name if s.teacher else None,
            "day_of_week": s.day_of_week.value,
            "start_time": s.start_time.strftime("%H:%M"),
            "end_time": s.end_time.strftime("%H:%M"),
            "room": s.room,
        }
        for s in schedules
    ]


@router.post("")
async def create_schedule(
    data: ScheduleCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    schedule = Schedule(
        classroom_id=data.classroom_id,
        teacher_id=data.teacher_id,
        academy_id=user.academy_id,
        day_of_week=data.day_of_week,
        start_time=parse_time(data.start_time),
        end_time=parse_time(data.end_time),
        room=data.room,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.patch("/{schedule_id}")
async def update_schedule(
    schedule_id: int,
    data: ScheduleUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    schedule = await db.get(Schedule, schedule_id)
    if not schedule or schedule.academy_id != user.academy_id:
        raise HTTPException(status_code=404, detail="시간표를 찾을 수 없습니다")

    update_data = data.model_dump(exclude_unset=True)
    if "start_time" in update_data:
        update_data["start_time"] = parse_time(update_data["start_time"])
    if "end_time" in update_data:
        update_data["end_time"] = parse_time(update_data["end_time"])

    for key, value in update_data.items():
        setattr(schedule, key, value)

    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    schedule = await db.get(Schedule, schedule_id)
    if not schedule or schedule.academy_id != user.academy_id:
        raise HTTPException(status_code=404, detail="시간표를 찾을 수 없습니다")

    await db.delete(schedule)
    await db.commit()
    return {"ok": True}
