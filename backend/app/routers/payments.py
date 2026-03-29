from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_current_user, require_owner
from app.models.user import User
from app.models.payment import Invoice, Payment, InvoiceStatus

router = APIRouter()


class InvoiceCreate(BaseModel):
    student_id: int
    amount: int
    description: str | None = None
    due_date: str  # "2026-04-15"


class InvoiceBulkCreate(BaseModel):
    student_ids: list[int]
    amount: int
    description: str | None = None
    due_date: str


class PaymentConfirm(BaseModel):
    amount: int
    method: str | None = None
    note: str | None = None


@router.get("/invoices")
async def list_invoices(
    status: str | None = None,
    month: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Invoice).where(Invoice.academy_id == user.academy_id)
    if status:
        query = query.where(Invoice.status == InvoiceStatus(status))
    if month:
        year, m = month.split("-")
        query = query.where(
            Invoice.due_date >= date(int(year), int(m), 1),
        )
    query = query.options(selectinload(Invoice.student)).order_by(Invoice.due_date.desc())
    result = await db.execute(query)

    return [
        {
            "id": inv.id,
            "student_id": inv.student_id,
            "student_name": inv.student.name,
            "amount": inv.amount,
            "description": inv.description,
            "status": inv.status.value,
            "due_date": str(inv.due_date),
            "paid_date": str(inv.paid_date) if inv.paid_date else None,
        }
        for inv in result.scalars().all()
    ]


@router.post("/invoices")
async def create_invoice(
    data: InvoiceCreate,
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    invoice = Invoice(
        student_id=data.student_id,
        academy_id=user.academy_id,
        amount=data.amount,
        description=data.description,
        due_date=date.fromisoformat(data.due_date),
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    return invoice


@router.post("/invoices/bulk")
async def bulk_create_invoices(
    data: InvoiceBulkCreate,
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    invoices = []
    for student_id in data.student_ids:
        inv = Invoice(
            student_id=student_id,
            academy_id=user.academy_id,
            amount=data.amount,
            description=data.description,
            due_date=date.fromisoformat(data.due_date),
        )
        db.add(inv)
        invoices.append(inv)

    await db.commit()
    return {"created": len(invoices)}


@router.post("/invoices/{invoice_id}/pay")
async def confirm_payment(
    invoice_id: int,
    data: PaymentConfirm,
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or invoice.academy_id != user.academy_id:
        raise HTTPException(status_code=404)

    payment = Payment(
        invoice_id=invoice_id,
        academy_id=user.academy_id,
        amount=data.amount,
        method=data.method,
        note=data.note,
    )
    db.add(payment)

    invoice.status = InvoiceStatus.PAID
    invoice.paid_date = date.today()
    await db.commit()

    return {"ok": True}
