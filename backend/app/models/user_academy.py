import enum
from datetime import datetime

from sqlalchemy import ForeignKey, Enum, DateTime, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MemberRole(str, enum.Enum):
    OWNER = "owner"
    VICE_OWNER = "vice_owner"
    TEACHER = "teacher"


class UserAcademy(Base):
    """유저-학원 소속 관계 (N:N)"""
    __tablename__ = "user_academies"
    __table_args__ = (UniqueConstraint("user_id", "academy_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    academy_id: Mapped[int] = mapped_column(ForeignKey("academies.id"))
    role: Mapped[MemberRole] = mapped_column(Enum(MemberRole))
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()
    academy: Mapped["Academy"] = relationship()
