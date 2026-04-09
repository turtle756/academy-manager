from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Academy(Base):
    __tablename__ = "academies"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(String(500))
    address_detail: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(20))
    bank_name: Mapped[str | None] = mapped_column(String(50))
    bank_account: Mapped[str | None] = mapped_column(String(50))
    bank_holder: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    classrooms: Mapped[list["Classroom"]] = relationship(back_populates="academy")
    students: Mapped[list["Student"]] = relationship(back_populates="academy")
    schedules: Mapped[list["Schedule"]] = relationship(back_populates="academy")
    notices: Mapped[list["Notice"]] = relationship(back_populates="academy")
