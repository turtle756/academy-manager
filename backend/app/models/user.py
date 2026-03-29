import enum
from datetime import datetime

from sqlalchemy import String, Enum, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserRole(str, enum.Enum):
    OWNER = "owner"
    TEACHER = "teacher"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    picture: Mapped[str | None] = mapped_column(String(500))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.OWNER)
    academy_id: Mapped[int | None] = mapped_column(ForeignKey("academies.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    academy: Mapped["Academy | None"] = relationship(back_populates="users")
