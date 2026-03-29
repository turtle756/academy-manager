import enum
from datetime import datetime

from sqlalchemy import String, ForeignKey, Enum, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class InviteRole(str, enum.Enum):
    OWNER = "owner"
    TEACHER = "teacher"


class Invitation(Base):
    """원장이 미리 등록하는 초대 — 이메일 + 역할"""
    __tablename__ = "invitations"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[InviteRole] = mapped_column(Enum(InviteRole))
    academy_id: Mapped[int] = mapped_column(ForeignKey("academies.id"))
    invited_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    used: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
