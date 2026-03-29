from datetime import datetime, date

from sqlalchemy import String, ForeignKey, DateTime, Date, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Counseling(Base):
    __tablename__ = "counselings"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    academy_id: Mapped[int] = mapped_column(ForeignKey("academies.id"))
    date: Mapped[date] = mapped_column(Date)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["Student"] = relationship(back_populates="counselings")
    teacher: Mapped["User"] = relationship()
