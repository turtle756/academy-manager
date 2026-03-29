from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.notice import Notice

router = APIRouter()


class NoticeCreate(BaseModel):
    title: str
    content: str
    send_alimtalk: bool = False


@router.get("")
async def list_notices(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notice)
        .where(Notice.academy_id == user.academy_id)
        .order_by(Notice.created_at.desc())
    )
    return [
        {
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "sent_alimtalk": n.sent_alimtalk,
            "created_at": n.created_at.isoformat(),
        }
        for n in result.scalars().all()
    ]


@router.post("")
async def create_notice(
    data: NoticeCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notice = Notice(
        academy_id=user.academy_id,
        author_id=user.id,
        title=data.title,
        content=data.content,
        sent_alimtalk=data.send_alimtalk,
    )
    db.add(notice)
    await db.commit()
    await db.refresh(notice)

    # TODO: If send_alimtalk, send via Kakao API
    return notice


@router.delete("/{notice_id}")
async def delete_notice(
    notice_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notice = await db.get(Notice, notice_id)
    if not notice or notice.academy_id != user.academy_id:
        raise HTTPException(status_code=404)

    await db.delete(notice)
    await db.commit()
    return {"ok": True}
