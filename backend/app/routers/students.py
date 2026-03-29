import io
import random
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import qrcode
from qrcode.image.svg import SvgImage

from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.student import Student

router = APIRouter()


def generate_pin() -> str:
    return "".join(random.choices(string.digits, k=4))


def generate_qr_token() -> str:
    return secrets.token_urlsafe(16)


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
        qr_token=generate_qr_token(),
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


@router.get("/{student_id}/qr-card")
async def get_qr_card_svg(
    student_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """학생 개인 QR 카드 SVG 이미지"""
    student = await db.get(Student, student_id)
    if not student or student.academy_id != user.academy_id:
        raise HTTPException(status_code=404)

    if not student.qr_token:
        student.qr_token = generate_qr_token()
        await db.commit()

    qr_data = f"ACADEMY_CHECKIN:{student.qr_token}"
    img = qrcode.make(qr_data, image_factory=SvgImage, box_size=10)
    buf = io.BytesIO()
    img.save(buf)
    buf.seek(0)

    return StreamingResponse(buf, media_type="image/svg+xml")


@router.post("/{student_id}/register-nfc")
async def register_nfc(
    student_id: int,
    nfc_uid: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """NFC 카드 UID를 학생에게 등록"""
    student = await db.get(Student, student_id)
    if not student or student.academy_id != user.academy_id:
        raise HTTPException(status_code=404)

    # Check if UID already used
    existing = await db.execute(
        select(Student).where(Student.nfc_uid == nfc_uid)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="이미 등록된 NFC 카드입니다")

    student.nfc_uid = nfc_uid
    await db.commit()
    return {"ok": True, "student_name": student.name}


@router.post("/{student_id}/reset-qr")
async def reset_qr_token(
    student_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """QR 토큰 재발급 (카드 분실 시)"""
    student = await db.get(Student, student_id)
    if not student or student.academy_id != user.academy_id:
        raise HTTPException(status_code=404)

    student.qr_token = generate_qr_token()
    await db.commit()
    return {"ok": True, "qr_token": student.qr_token}
