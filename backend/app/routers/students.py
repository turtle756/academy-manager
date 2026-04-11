import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_membership
from app.models.user_academy import UserAcademy
from app.models.student import Student

router = APIRouter()


class StudentCreate(BaseModel):
    name: str
    phone: str | None = None
    parent_phone: str | None = None
    parent_name: str | None = None
    school: str | None = None
    grade: str | None = None
    monthly_fee: int = 0
    payment_due_day: int = 10


class StudentUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    parent_phone: str | None = None
    parent_name: str | None = None
    school: str | None = None
    grade: str | None = None
    monthly_fee: int | None = None
    payment_due_day: int | None = None


@router.get("")
async def list_students(
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Student).where(Student.academy_id == membership.academy_id)
    )
    return result.scalars().all()


@router.post("")
async def create_student(
    data: StudentCreate,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    student = Student(
        **data.model_dump(),
        academy_id=membership.academy_id,
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return student


@router.get("/{student_id}")
async def get_student(
    student_id: int,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    student = await db.get(Student, student_id)
    if not student or student.academy_id != membership.academy_id:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다")
    return student


@router.patch("/{student_id}")
async def update_student(
    student_id: int,
    data: StudentUpdate,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    student = await db.get(Student, student_id)
    if not student or student.academy_id != membership.academy_id:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(student, key, value)
    await db.commit()
    await db.refresh(student)
    return student


@router.delete("/{student_id}")
async def delete_student(
    student_id: int,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    student = await db.get(Student, student_id)
    if not student or student.academy_id != membership.academy_id:
        raise HTTPException(status_code=404, detail="학생을 찾을 수 없습니다")
    await db.delete(student)
    await db.commit()
    return {"ok": True}


@router.post("/{student_id}/register-nfc")
async def register_nfc(
    student_id: int,
    nfc_uid: str,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    """NFC 카드 등록 (기존 등록이 있으면 덮어쓰기)"""
    student = await db.get(Student, student_id)
    if not student or student.academy_id != membership.academy_id:
        raise HTTPException(status_code=404)

    # 다른 학생에게 등록된 카드인지 확인
    existing = await db.execute(
        select(Student).where(Student.nfc_uid == nfc_uid, Student.id != student_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="이 카드는 다른 학생에게 등록되어 있습니다")

    student.nfc_uid = nfc_uid
    await db.commit()
    return {"ok": True, "student_name": student.name}


@router.post("/{student_id}/unregister-nfc")
async def unregister_nfc(
    student_id: int,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    """NFC 카드 등록 해제"""
    student = await db.get(Student, student_id)
    if not student or student.academy_id != membership.academy_id:
        raise HTTPException(status_code=404)
    student.nfc_uid = None
    await db.commit()
    return {"ok": True}
