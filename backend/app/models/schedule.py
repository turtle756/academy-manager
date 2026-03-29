import enum
from datetime import time, datetime

from sqlalchemy import String, ForeignKey, Enum, Time, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DayOfWeek(str, enum.Enum):
    MON = "mon"
    TUE = "tue"
    WED = "wed"
    THU = "thu"
    FRI = "fri"
    SAT = "sat"
    SUN = "sun"


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id"))
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    academy_id: Mapped[int] = mapped_column(ForeignKey("academies.id"))
    day_of_week: Mapped[DayOfWeek] = mapped_column(Enum(DayOfWeek))
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    room: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    classroom: Mapped["Classroom"] = relationship(back_populates="schedules")
    teacher: Mapped["User | None"] = relationship()
    academy: Mapped["Academy"] = relationship(back_populates="schedules")
