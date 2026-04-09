from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_membership
from app.models.user_academy import UserAcademy
from app.models.classroom import Classroom, StudentClassroom

router = APIRouter()


class ClassroomCreate(BaseModel):
    name: str


class ClassroomUpdate(BaseModel):
    name: str | None = None


class StudentAssign(BaseModel):
    student_ids: list[int]


@router.get("")
async def list_classrooms(
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Classroom)
        .where(Classroom.academy_id == membership.academy_id)
        .options(selectinload(Classroom.students).selectinload(StudentClassroom.student))
    )
    return result.scalars().all()


@router.post("")
async def create_classroom(
    data: ClassroomCreate,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    classroom = Classroom(name=data.name, academy_id=membership.academy_id)
    db.add(classroom)
    await db.commit()
    await db.refresh(classroom)
    return classroom


@router.patch("/{classroom_id}")
async def update_classroom(
    classroom_id: int,
    data: ClassroomUpdate,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    classroom = await db.get(Classroom, classroom_id)
    if not classroom or classroom.academy_id != membership.academy_id:
        raise HTTPException(status_code=404, detail="반을 찾을 수 없습니다")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(classroom, key, value)
    await db.commit()
    await db.refresh(classroom)
    return classroom


@router.delete("/{classroom_id}")
async def delete_classroom(
    classroom_id: int,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    classroom = await db.get(Classroom, classroom_id)
    if not classroom or classroom.academy_id != membership.academy_id:
        raise HTTPException(status_code=404, detail="반을 찾을 수 없습니다")
    await db.delete(classroom)
    await db.commit()
    return {"ok": True}


@router.post("/{classroom_id}/students")
async def assign_students(
    classroom_id: int,
    data: StudentAssign,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    classroom = await db.get(Classroom, classroom_id)
    if not classroom or classroom.academy_id != membership.academy_id:
        raise HTTPException(status_code=404, detail="반을 찾을 수 없습니다")
    for student_id in data.student_ids:
        existing = await db.execute(
            select(StudentClassroom).where(
                StudentClassroom.student_id == student_id,
                StudentClassroom.classroom_id == classroom_id,
            )
        )
        if not existing.scalar_one_or_none():
            db.add(StudentClassroom(student_id=student_id, classroom_id=classroom_id))
    await db.commit()
    return {"ok": True}
