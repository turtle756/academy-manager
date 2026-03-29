from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.grade import Grade

router = APIRouter()


class GradeCreate(BaseModel):
    student_id: int
    classroom_id: int
    exam_name: str
    score: int
    total_score: int = 100
    date: str
    note: str | None = None


class GradeBulkCreate(BaseModel):
    classroom_id: int
    exam_name: str
    total_score: int = 100
    date: str
    scores: list[dict]  # [{"student_id": 1, "score": 85}, ...]


@router.get("")
async def list_grades(
    classroom_id: int | None = None,
    student_id: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Grade).where(Grade.academy_id == user.academy_id)
    if classroom_id:
        query = query.where(Grade.classroom_id == classroom_id)
    if student_id:
        query = query.where(Grade.student_id == student_id)

    query = query.options(selectinload(Grade.student)).order_by(Grade.date.desc())
    result = await db.execute(query)

    return [
        {
            "id": g.id,
            "student_id": g.student_id,
            "student_name": g.student.name,
            "classroom_id": g.classroom_id,
            "exam_name": g.exam_name,
            "score": g.score,
            "total_score": g.total_score,
            "date": str(g.date),
            "note": g.note,
        }
        for g in result.scalars().all()
    ]


@router.post("")
async def create_grade(
    data: GradeCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    grade = Grade(
        student_id=data.student_id,
        classroom_id=data.classroom_id,
        academy_id=user.academy_id,
        exam_name=data.exam_name,
        score=data.score,
        total_score=data.total_score,
        date=date.fromisoformat(data.date),
        note=data.note,
    )
    db.add(grade)
    await db.commit()
    await db.refresh(grade)
    return grade


@router.post("/bulk")
async def bulk_create_grades(
    data: GradeBulkCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    grades = []
    for item in data.scores:
        g = Grade(
            student_id=item["student_id"],
            classroom_id=data.classroom_id,
            academy_id=user.academy_id,
            exam_name=data.exam_name,
            score=item["score"],
            total_score=data.total_score,
            date=date.fromisoformat(data.date),
        )
        db.add(g)
        grades.append(g)

    await db.commit()
    return {"created": len(grades)}
