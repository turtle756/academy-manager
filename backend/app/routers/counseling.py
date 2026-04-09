from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user, get_membership
from app.models.user import User
from app.models.user_academy import UserAcademy
from app.models.counseling import Counseling

router = APIRouter()


class CounselingCreate(BaseModel):
    student_id: int
    date: str
    title: str
    content: str


@router.get("")
async def list_counselings(
    student_id: int | None = None,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    query = select(Counseling).where(Counseling.academy_id == membership.academy_id)
    if student_id: query = query.where(Counseling.student_id == student_id)
    query = query.options(selectinload(Counseling.student), selectinload(Counseling.teacher)).order_by(Counseling.date.desc())
    result = await db.execute(query)
    return [
        {"id": c.id, "student_id": c.student_id, "student_name": c.student.name,
         "teacher_name": c.teacher.name, "date": str(c.date), "title": c.title, "content": c.content}
        for c in result.scalars().all()
    ]


@router.post("")
async def create_counseling(
    data: CounselingCreate,
    user: User = Depends(get_current_user),
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    counseling = Counseling(student_id=data.student_id, teacher_id=user.id,
                            academy_id=membership.academy_id,
                            date=date.fromisoformat(data.date), title=data.title, content=data.content)
    db.add(counseling)
    await db.commit()
    await db.refresh(counseling)
    return counseling


@router.delete("/{counseling_id}")
async def delete_counseling(
    counseling_id: int,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    counseling = await db.get(Counseling, counseling_id)
    if not counseling or counseling.academy_id != membership.academy_id:
        raise HTTPException(status_code=404)
    await db.delete(counseling)
    await db.commit()
    return {"ok": True}
