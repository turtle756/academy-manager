from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_membership, require_owner
from app.models.user_academy import UserAcademy
from app.models.payment import Invoice, Payment, InvoiceStatus

router = APIRouter()


class InvoiceCreate(BaseModel):
    student_id: int
    amount: int
    description: str | None = None
    due_date: str


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
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    query = select(Invoice).where(Invoice.academy_id == membership.academy_id)
    if status:
        query = query.where(Invoice.status == InvoiceStatus(status))
    query = query.options(selectinload(Invoice.student)).order_by(Invoice.due_date.desc())
    result = await db.execute(query)
    return [
        {"id": inv.id, "student_id": inv.student_id, "student_name": inv.student.name,
         "amount": inv.amount, "description": inv.description, "status": inv.status.value,
         "due_date": str(inv.due_date), "paid_date": str(inv.paid_date) if inv.paid_date else None}
        for inv in result.scalars().all()
    ]


@router.post("/invoices")
async def create_invoice(
    data: InvoiceCreate,
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    invoice = Invoice(student_id=data.student_id, academy_id=membership.academy_id,
                      amount=data.amount, description=data.description, due_date=date.fromisoformat(data.due_date))
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    return invoice


@router.post("/invoices/bulk")
async def bulk_create_invoices(
    data: InvoiceBulkCreate,
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    for student_id in data.student_ids:
        db.add(Invoice(student_id=student_id, academy_id=membership.academy_id,
                       amount=data.amount, description=data.description, due_date=date.fromisoformat(data.due_date)))
    await db.commit()
    return {"created": len(data.student_ids)}


@router.post("/invoices/{invoice_id}/pay")
async def confirm_payment(
    invoice_id: int, data: PaymentConfirm,
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or invoice.academy_id != membership.academy_id:
        raise HTTPException(status_code=404)
    db.add(Payment(invoice_id=invoice_id, academy_id=membership.academy_id, amount=data.amount, method=data.method, note=data.note))
    invoice.status = InvoiceStatus.PAID
    invoice.paid_date = date.today()
    await db.commit()
    return {"ok": True}
