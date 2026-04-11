from datetime import date, timedelta
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.auth import get_membership, require_owner
from app.models.user_academy import UserAcademy
from app.models.payment import Invoice, Payment, InvoiceStatus
from app.models.student import Student
from app.models.classroom import Classroom, StudentClassroom

router = APIRouter()


class InvoiceCreate(BaseModel):
    student_id: int
    amount: int
    description: str | None = None
    due_date: str


class PaymentConfirm(BaseModel):
    amount: int
    method: str | None = None
    note: str | None = None
    paid_date: str | None = None


class BulkGenerate(BaseModel):
    month: str  # "2026-04"
    due_day: int = 10  # 매월 N일을 납부 기한으로


# ============ 월별 대시보드 ============

@router.get("/summary")
async def payment_summary(
    month: str,  # "2026-04"
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    """월별 수납 요약"""
    year, m = month.split("-")
    start = date(int(year), int(m), 1)
    _, num_days = monthrange(int(year), int(m))
    end = date(int(year), int(m), num_days)

    # 해당 월에 due_date가 있는 청구서들
    result = await db.execute(
        select(Invoice).where(
            Invoice.academy_id == membership.academy_id,
            Invoice.due_date >= start,
            Invoice.due_date <= end,
        )
    )
    invoices = result.scalars().all()

    total_amount = sum(inv.amount for inv in invoices)
    paid_amount = sum(inv.amount for inv in invoices if inv.status == InvoiceStatus.PAID)
    unpaid_amount = total_amount - paid_amount
    paid_count = sum(1 for inv in invoices if inv.status == InvoiceStatus.PAID)
    unpaid_count = len(invoices) - paid_count

    return {
        "month": month,
        "total_amount": total_amount,
        "paid_amount": paid_amount,
        "unpaid_amount": unpaid_amount,
        "total_count": len(invoices),
        "paid_count": paid_count,
        "unpaid_count": unpaid_count,
        "paid_rate": round(paid_amount / total_amount * 100, 1) if total_amount else 0,
    }


# ============ 청구서 목록 ============

@router.get("/invoices")
async def list_invoices(
    month: str | None = None,
    status: str | None = None,
    student_id: int | None = None,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    query = select(Invoice).where(Invoice.academy_id == membership.academy_id)

    if month:
        year, m = month.split("-")
        start = date(int(year), int(m), 1)
        _, num_days = monthrange(int(year), int(m))
        end = date(int(year), int(m), num_days)
        query = query.where(Invoice.due_date >= start, Invoice.due_date <= end)

    if status:
        query = query.where(Invoice.status == InvoiceStatus(status))

    if student_id:
        query = query.where(Invoice.student_id == student_id)

    query = query.options(selectinload(Invoice.student)).order_by(Invoice.due_date.desc())
    result = await db.execute(query)

    return [
        {
            "id": inv.id,
            "student_id": inv.student_id,
            "student_name": inv.student.name,
            "parent_phone": inv.student.parent_phone,
            "amount": inv.amount,
            "description": inv.description,
            "status": inv.status.value,
            "due_date": str(inv.due_date),
            "paid_date": str(inv.paid_date) if inv.paid_date else None,
            "days_overdue": (date.today() - inv.due_date).days if inv.status != InvoiceStatus.PAID and inv.due_date < date.today() else 0,
        }
        for inv in result.scalars().all()
    ]


@router.get("/invoices/by-student/{student_id}")
async def list_invoices_by_student(
    student_id: int,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    """학생별 납부 이력"""
    query = select(Invoice).where(
        Invoice.academy_id == membership.academy_id,
        Invoice.student_id == student_id,
    ).options(selectinload(Invoice.payments)).order_by(Invoice.due_date.desc())
    result = await db.execute(query)

    return [
        {
            "id": inv.id,
            "amount": inv.amount,
            "description": inv.description,
            "status": inv.status.value,
            "due_date": str(inv.due_date),
            "paid_date": str(inv.paid_date) if inv.paid_date else None,
            "payments": [
                {"method": p.method, "amount": p.amount, "paid_at": p.paid_at.isoformat()}
                for p in inv.payments
            ],
        }
        for inv in result.scalars().all()
    ]


# ============ 청구서 생성 ============

@router.post("/invoices")
async def create_invoice(
    data: InvoiceCreate,
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    invoice = Invoice(
        student_id=data.student_id,
        academy_id=membership.academy_id,
        amount=data.amount,
        description=data.description,
        due_date=date.fromisoformat(data.due_date),
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    return invoice


@router.post("/invoices/bulk-generate")
async def bulk_generate_invoices(
    data: BulkGenerate,
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """월 청구서 일괄 생성 — 반별 월 수강료 기준으로 각 학생에게 자동 생성"""
    year, m = data.month.split("-")
    year_i, m_i = int(year), int(m)
    _, num_days = monthrange(year_i, m_i)
    due_day = min(data.due_day, num_days)
    due_date = date(year_i, m_i, due_day)
    start = date(year_i, m_i, 1)
    end = date(year_i, m_i, num_days)

    # 학원의 모든 반+학생 로드
    result = await db.execute(
        select(Classroom)
        .where(Classroom.academy_id == membership.academy_id)
        .options(selectinload(Classroom.students).selectinload(StudentClassroom.student))
    )
    classrooms = result.scalars().all()

    # 학생별 총 수강료 계산 (여러 반 수강 시 합산)
    student_fees: dict[int, tuple[int, list[str]]] = {}  # {student_id: (total_fee, [classroom names])}
    for c in classrooms:
        if c.monthly_fee <= 0:
            continue
        for sc in c.students:
            sid = sc.student.id
            if sid not in student_fees:
                student_fees[sid] = (0, [])
            total, names = student_fees[sid]
            student_fees[sid] = (total + c.monthly_fee, names + [c.name])

    created = 0
    skipped = 0

    for sid, (fee, names) in student_fees.items():
        # 중복 체크: 같은 달에 이미 청구서 있으면 스킵
        existing = await db.execute(
            select(Invoice).where(
                Invoice.student_id == sid,
                Invoice.academy_id == membership.academy_id,
                Invoice.due_date >= start,
                Invoice.due_date <= end,
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        description = f"{int(m)}월 수강료 ({', '.join(names)})"
        db.add(Invoice(
            student_id=sid,
            academy_id=membership.academy_id,
            amount=fee,
            description=description,
            due_date=due_date,
        ))
        created += 1

    await db.commit()
    return {"created": created, "skipped": skipped}


# ============ 수납 처리 ============

@router.post("/invoices/{invoice_id}/pay")
async def confirm_payment(
    invoice_id: int,
    data: PaymentConfirm,
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or invoice.academy_id != membership.academy_id:
        raise HTTPException(status_code=404)

    paid_date = date.fromisoformat(data.paid_date) if data.paid_date else date.today()

    db.add(Payment(
        invoice_id=invoice_id,
        academy_id=membership.academy_id,
        amount=data.amount,
        method=data.method,
        note=data.note,
    ))
    invoice.status = InvoiceStatus.PAID
    invoice.paid_date = paid_date
    await db.commit()
    return {"ok": True}


@router.post("/invoices/{invoice_id}/unpay")
async def revert_payment(
    invoice_id: int,
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """수납 취소 (실수로 체크한 경우)"""
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or invoice.academy_id != membership.academy_id:
        raise HTTPException(status_code=404)
    invoice.status = InvoiceStatus.PENDING
    invoice.paid_date = None
    await db.commit()
    return {"ok": True}


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(
    invoice_id: int,
    membership: UserAcademy = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice or invoice.academy_id != membership.academy_id:
        raise HTTPException(status_code=404)
    await db.delete(invoice)
    await db.commit()
    return {"ok": True}


# ============ 연간 매트릭스 ============

@router.get("/yearly-matrix")
async def yearly_matrix(
    year: int,
    membership: UserAcademy = Depends(get_membership),
    db: AsyncSession = Depends(get_db),
):
    """학생 × 월 매트릭스 — 예체능 학원용 연간 수납표"""
    start = date(year, 1, 1)
    end = date(year, 12, 31)

    # 학생 목록
    student_result = await db.execute(
        select(Student).where(Student.academy_id == membership.academy_id).order_by(Student.name)
    )
    students = student_result.scalars().all()

    # 해당 년도 청구서
    inv_result = await db.execute(
        select(Invoice).where(
            Invoice.academy_id == membership.academy_id,
            Invoice.due_date >= start,
            Invoice.due_date <= end,
        )
    )
    invoices = inv_result.scalars().all()

    # (student_id, month) -> status
    matrix: dict[tuple[int, int], str] = {}
    for inv in invoices:
        key = (inv.student_id, inv.due_date.month)
        current = matrix.get(key)
        # 우선순위: paid > pending
        if current == "paid":
            continue
        matrix[key] = inv.status.value

    return {
        "year": year,
        "students": [
            {
                "id": s.id,
                "name": s.name,
                "months": [matrix.get((s.id, m)) for m in range(1, 13)],
            }
            for s in students
        ],
    }
