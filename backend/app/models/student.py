from datetime import datetime

from sqlalchemy import String, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20))
    parent_phone: Mapped[str | None] = mapped_column(String(20))
    parent_name: Mapped[str | None] = mapped_column(String(100))
    school: Mapped[str | None] = mapped_column(String(100))
    grade: Mapped[str | None] = mapped_column(String(20))
    pin_code: Mapped[str | None] = mapped_column(String(10))
    nfc_uid: Mapped[str | None] = mapped_column(String(100), unique=True)
    qr_token: Mapped[str | None] = mapped_column(String(100), unique=True)
    academy_id: Mapped[int] = mapped_column(ForeignKey("academies.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    academy: Mapped["Academy"] = relationship(back_populates="students")
    classrooms: Mapped[list["StudentClassroom"]] = relationship(back_populates="student")
    attendances: Mapped[list["Attendance"]] = relationship(back_populates="student")
    grades: Mapped[list["Grade"]] = relationship(back_populates="student")
    counselings: Mapped[list["Counseling"]] = relationship(back_populates="student")
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="student")
