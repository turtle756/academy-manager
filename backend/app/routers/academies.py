from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user, get_membership, require_owner
from app.models.user import User
from app.models.user_academy import UserAcademy, MemberRole
from app.models.academy import Academy

router = APIRouter()


class AcademyUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    address_detail: str | None = None
    phone: str | None = None
    bank_name: str | None = None
    bank_account: str | None = None
    bank_holder: str | None = None


@router.get("")
async def get_academy(
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    academy = await db.get(Academy, membership.academy_id)
    return academy


@router.get("/my")
async def list_my_academies(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내가 소속된 학원 목록"""
    result = await db.execute(
        select(UserAcademy, Academy)
        .join(Academy, UserAcademy.academy_id == Academy.id)
        .where(UserAcademy.user_id == user.id)
    )
    return [
        {
            "academy_id": ua.academy_id,
            "name": academy.name,
            "role": ua.role.value,
            "joined_at": ua.joined_at.isoformat() if ua.joined_at else None,
        }
        for ua, academy in result.all()
    ]


@router.patch("")
async def update_academy(
    data: AcademyUpdate,
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    academy = await db.get(Academy, membership.academy_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(academy, key, value)

    await db.commit()
    await db.refresh(academy)
    return academy


@router.get("/members")
async def list_members(
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """학원 구성원 목록 (원장만)"""
    result = await db.execute(
        select(UserAcademy).where(UserAcademy.academy_id == membership.academy_id)
    )
    members = result.scalars().all()
    from app.models.user import User as UserModel
    out = []
    for m in members:
        user = await db.get(UserModel, m.user_id)
        out.append({
            "user_id": m.user_id,
            "name": user.name if user else "",
            "email": user.email if user else "",
            "role": m.role.value,
        })
    return out


@router.patch("/members/{user_id}/role")
async def update_member_role(
    user_id: int,
    data: dict,
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """구성원 역할 변경 (원장만)"""
    result = await db.execute(
        select(UserAcademy).where(
            UserAcademy.user_id == user_id,
            UserAcademy.academy_id == membership.academy_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="구성원을 찾을 수 없습니다")
    if member.user_id == membership.user_id:
        raise HTTPException(status_code=400, detail="자신의 역할은 변경할 수 없습니다")
    new_role = data.get("role")
    if new_role not in ("owner", "vice_owner", "teacher"):
        raise HTTPException(status_code=400, detail="유효하지 않은 역할입니다")
    member.role = MemberRole(new_role)
    await db.commit()
    return {"ok": True}


@router.delete("/members/{user_id}")
async def remove_member(
    user_id: int,
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """구성원 제거 (원장만)"""
    if user_id == membership.user_id:
        raise HTTPException(status_code=400, detail="자신은 제거할 수 없습니다")
    result = await db.execute(
        select(UserAcademy).where(
            UserAcademy.user_id == user_id,
            UserAcademy.academy_id == membership.academy_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="구성원을 찾을 수 없습니다")
    await db.delete(member)
    await db.commit()
    return {"ok": True}


@router.delete("")
async def delete_academy(
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """학원 삭제 — 원장만, 모든 데이터 cascade 삭제"""
    academy_id = membership.academy_id
    # cascade: DB FK on delete or manual
    from app.models.student import Student
    from app.models.classroom import Classroom, StudentClassroom
    from app.models.payment import Invoice, Payment
    from app.models.attendance import Attendance
    from app.models.counseling import Counseling
    from app.models.schedule import Schedule

    from app.models.grade import Grade
    from app.models.invitation import Invitation

    # 순서 중요: FK 참조하는 테이블부터 삭제
    for model in [Payment, Invoice, Attendance, Counseling, Grade]:
        await db.execute(delete(model).where(model.academy_id == academy_id))
    await db.execute(delete(StudentClassroom).where(
        StudentClassroom.student_id.in_(
            select(Student.id).where(Student.academy_id == academy_id)
        )
    ))
    await db.execute(delete(Schedule).where(Schedule.academy_id == academy_id))
    await db.execute(delete(Classroom).where(Classroom.academy_id == academy_id))
    await db.execute(delete(Student).where(Student.academy_id == academy_id))
    await db.execute(delete(Invitation).where(Invitation.academy_id == academy_id))
    await db.execute(delete(UserAcademy).where(UserAcademy.academy_id == academy_id))
    academy = await db.get(Academy, academy_id)
    if academy:
        await db.delete(academy)
    await db.commit()
    return {"ok": True}
