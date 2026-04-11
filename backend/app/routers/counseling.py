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
    counseling_type: str = "regular"
    status: str = "scheduled"
    title: str | None = None
    issue: str | None = None
    agreement: str | None = None
    followup: str | None = None
    result: str | None = None
    next_date: str | None = None


class CounselingUpdate(BaseModel):
    status: str | None = None
    title: str | None = None
    issue: str | None = None
    agreement: str | None = None
    followup: str | None = None
    result: str | None = None
    next_date: str | None = None


def _serialize(c: Counseling) -> dict:
    return {
        "id": c.id,
        "student_id": c.student_id,
        "student_name": c.student.name,
        "teacher_name": c.teacher.name,
        "date": str(c.date),
        "counseling_type": c.counseling_type,
        "status": c.status,
        "title": c.title,
        "issue": c.issue,
        "agreement": c.agreement,
        "followup": c.followup,
        "result": c.result,
        "next_date": str(c.next_date) if c.next_date else None,
    }


@router.get("")
async def list_counselings(
    student_id: int | None = None,
    status: str | None = None,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    query = select(Counseling).where(Counseling.academy_id == membership.academy_id)
    if student_id:
        query = query.where(Counseling.student_id == student_id)
    if status:
        query = query.where(Counseling.status == status)
    query = query.options(
        selectinload(Counseling.student), selectinload(Counseling.teacher)
    ).order_by(Counseling.date.desc())
    result = await db.execute(query)
    return [_serialize(c) for c in result.scalars().all()]


@router.post("")
async def create_counseling(
    data: CounselingCreate,
    user: User = Depends(get_current_user),
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    counseling = Counseling(
        student_id=data.student_id,
        teacher_id=user.id,
        academy_id=membership.academy_id,
        date=date.fromisoformat(data.date),
        counseling_type=data.counseling_type,
        status=data.status,
        title=data.title,
        issue=data.issue,
        agreement=data.agreement,
        followup=data.followup,
        result=data.result,
        next_date=date.fromisoformat(data.next_date) if data.next_date else None,
    )
    db.add(counseling)
    await db.commit()
    await db.refresh(counseling)
    # reload with relationships
    await db.refresh(counseling, ["student", "teacher"])
    return _serialize(counseling)


@router.patch("/{counseling_id}")
async def update_counseling(
    counseling_id: int,
    data: CounselingUpdate,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    counseling = await db.get(Counseling, counseling_id)
    if not counseling or counseling.academy_id != membership.academy_id:
        raise HTTPException(status_code=404)
    for key, value in data.model_dump(exclude_unset=True).items():
        if key == "next_date":
            setattr(counseling, key, date.fromisoformat(value) if value else None)
        else:
            setattr(counseling, key, value)
    await db.commit()
    return {"ok": True}


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
