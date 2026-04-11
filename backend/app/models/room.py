from datetime import datetime

from sqlalchemy import String, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    academy_id: Mapped[int] = mapped_column(ForeignKey("academies.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    academy: Mapped["Academy"] = relationship(back_populates="rooms")
    schedules: Mapped[list["Schedule"]] = relationship(back_populates="room_obj")
