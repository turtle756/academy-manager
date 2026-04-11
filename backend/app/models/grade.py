from datetime import datetime, date

from sqlalchemy import String, Integer, ForeignKey, DateTime, Date, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Grade(Base):
    __tablename__ = "grades"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id"))
    academy_id: Mapped[int] = mapped_column(ForeignKey("academies.id"))
    exam_name: Mapped[str] = mapped_column(String(200))
    exam_type: Mapped[str] = mapped_column(String(30), default="academy", server_default="academy")
    score: Mapped[int] = mapped_column(Integer)
    total_score: Mapped[int] = mapped_column(Integer, default=100)
    date: Mapped[date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["Student"] = relationship(back_populates="grades")
