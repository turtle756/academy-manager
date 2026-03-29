import random
import string

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.student import Student

router = APIRouter()


def generate_pin() -> str:
    return "".join(random.choices(string.digits, k=4))


class StudentCreate(BaseModel):
    name: str
    phone: str | None = None
    parent_phone: str | None = None
    parent_name: str | None = None
    school: str | None = None
    grade: str | None = None


class StudentUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    parent_phone: str | None = None
    parent_name: str | None = None
    school: str | None = None
    grade: str | None = None


@router.get("")
async def list_students(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Student).where(Student.academy_id == user.academy_id)
    )
    return result.scalars().all()


@router.post("")
async def create_student(
    data: StudentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = Student(
        **data.model_dump(),
        pin_code=generate_pin(),
        academy_id=user.academy_id,
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return student


@router.get("/{student_id}")
async def get_student(
    student_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await db.get(Student, student_id)
    if not student or student.academy_id != user.academy_id:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다")
    return student


@router.patch("/{student_id}")
async def update_student(
    student_id: int,
    data: StudentUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await db.get(Student, student_id)
    if not student or student.academy_id != user.academy_id:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(student, key, value)

    await db.commit()
    await db.refresh(student)
    return student


@router.delete("/{student_id}")
async def delete_student(
    student_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await db.get(Student, student_id)
    if not student or student.academy_id != user.academy_id:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다")

    await db.delete(student)
    await db.commit()
    return {"ok": True}
