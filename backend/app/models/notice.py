from datetime import datetime

from sqlalchemy import String, ForeignKey, DateTime, Text, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Notice(Base):
    __tablename__ = "notices"

    id: Mapped[int] = mapped_column(primary_key=True)
    academy_id: Mapped[int] = mapped_column(ForeignKey("academies.id"))
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(300))
    content: Mapped[str] = mapped_column(Text)
    sent_alimtalk: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    academy: Mapped["Academy"] = relationship(back_populates="notices")
    author: Mapped["User"] = relationship()
