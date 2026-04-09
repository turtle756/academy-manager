import enum
from datetime import datetime

from sqlalchemy import String, ForeignKey, Enum, DateTime, Date, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AttendanceMethod(str, enum.Enum):
    QR = "qr"
    PIN = "pin"
    MANUAL = "manual"
    KIOSK = "kiosk"


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    LATE = "late"
    ABSENT = "absent"
    EARLY_LEAVE = "early_leave"


class AttendanceSession(Base):
    """출석 세션 — QR/PIN 출석을 열 때 생성"""
    __tablename__ = "attendance_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id"))
    schedule_id: Mapped[int | None] = mapped_column(ForeignKey("schedules.id"))
    academy_id: Mapped[int] = mapped_column(ForeignKey("academies.id"))
    method: Mapped[AttendanceMethod] = mapped_column(Enum(AttendanceMethod))
    qr_code: Mapped[str | None] = mapped_column(String(100))
    pin_code: Mapped[str | None] = mapped_column(String(10))
    is_active: Mapped[bool] = mapped_column(default=True)
    date: Mapped[datetime] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    attendances: Mapped[list["Attendance"]] = relationship(back_populates="session")


class Attendance(Base):
    """개별 학생 출석 기록"""
    __tablename__ = "attendances"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    session_id: Mapped[int | None] = mapped_column(ForeignKey("attendance_sessions.id"))
    classroom_id: Mapped[int | None] = mapped_column(ForeignKey("classrooms.id"), nullable=True)
    academy_id: Mapped[int] = mapped_column(ForeignKey("academies.id"))
    status: Mapped[AttendanceStatus] = mapped_column(Enum(AttendanceStatus))
    method: Mapped[AttendanceMethod] = mapped_column(Enum(AttendanceMethod))
    date: Mapped[datetime] = mapped_column(Date, index=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["Student"] = relationship(back_populates="attendances")
    session: Mapped["AttendanceSession | None"] = relationship(back_populates="attendances")
