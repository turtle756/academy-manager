from datetime import datetime

from sqlalchemy import String, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Classroom(Base):
    __tablename__ = "classrooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    academy_id: Mapped[int] = mapped_column(ForeignKey("academies.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    academy: Mapped["Academy"] = relationship(back_populates="classrooms")
    students: Mapped[list["StudentClassroom"]] = relationship(back_populates="classroom")
    schedules: Mapped[list["Schedule"]] = relationship(back_populates="classroom")


class StudentClassroom(Base):
    __tablename__ = "student_classrooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["Student"] = relationship(back_populates="classrooms")
    classroom: Mapped["Classroom"] = relationship(back_populates="students")
