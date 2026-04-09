import enum
from datetime import datetime

from sqlalchemy import String, ForeignKey, Enum, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class InviteRole(str, enum.Enum):
    OWNER = "owner"
    TEACHER = "teacher"


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    role: Mapped[InviteRole] = mapped_column(Enum(InviteRole))
    academy_id: Mapped[int] = mapped_column(ForeignKey("academies.id"))
    invited_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    invite_code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    used: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
