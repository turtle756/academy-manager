import enum
from datetime import datetime, date

from sqlalchemy import String, ForeignKey, DateTime, Date, Text, func, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CounselingType(str, enum.Enum):
    REGULAR = "regular"          # 정기 상담
    PARENT = "parent"            # 학부모 상담
    RETENTION = "retention"      # 퇴원방지 상담
    NEW_ENROLLMENT = "new_enrollment"  # 신규 등록 상담


class CounselingStatus(str, enum.Enum):
    SCHEDULED = "scheduled"   # 예정
    COMPLETED = "completed"   # 완료


class Counseling(Base):
    __tablename__ = "counselings"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    academy_id: Mapped[int] = mapped_column(ForeignKey("academies.id"))
    date: Mapped[date] = mapped_column(Date)

    counseling_type: Mapped[str] = mapped_column(String(30), default="regular")
    status: Mapped[str] = mapped_column(String(20), default="completed")

    # 공통
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # 유형별 본문 필드
    issue: Mapped[str | None] = mapped_column(Text, nullable=True)       # 현재 상황/문제/요구사항
    agreement: Mapped[str | None] = mapped_column(Text, nullable=True)   # 합의 내용
    followup: Mapped[str | None] = mapped_column(Text, nullable=True)    # 후속 조치
    result: Mapped[str | None] = mapped_column(String(50), nullable=True)  # 신규 상담 결과 (등록완료/보류/거절)
    next_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # 다음 상담 예정일 (정기만)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["Student"] = relationship(back_populates="counselings")
    teacher: Mapped["User"] = relationship()
