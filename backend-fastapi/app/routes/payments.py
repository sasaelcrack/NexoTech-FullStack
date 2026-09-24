import os
import uuid
import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db
from app.integrations.stripe_provider import StripeProvider
from app.repositories import payment_repository
from app.services.payment_service import aplicar_estado_pago, crear_pago_stripe, respuesta_pago


router = APIRouter(prefix="/api/v1", tags=["Payments"])


def _stripe_dict(value):
    if hasattr(value, "to_dict_recursive"):
        return value.to_dict_recursive()
    if hasattr(value, "to_dict"):
        return value.to_dict()
    return dict(value) if not isinstance(value, dict) else value


def _stripe_key() -> str:
    key = os.getenv("STRIPE_SECRET_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Stripe no está configurado")
    return key


def _response(payment: models.Payment) -> dict:
    return {
        "id": str(payment.id), "venta_id": payment.venta_id,
        "reference": payment.reference, "provider": payment.provider,
        "provider_transaction_id": payment.provider_transaction_id,
        "amount": float(payment.amount), "currency": payment.currency,
        "status": payment.status, "checkout_url": payment.checkout_url,
    }


def _status_from_checkout_session(session, event_type: str | None = None) -> str:
    session = session.to_dict_recursive() if hasattr(session, "to_dict_recursive") else session
    if event_type == "checkout.session.expired" or session.get("status") == "expired":
        return "EXPIRED"
    if session.get("payment_status") == "paid":
        return "APPROVED"
    if event_type == "checkout.session.async_payment_failed":
        return "DECLINED"
    return "PENDING"


@router.post("/payments", response_model=schemas.PaymentResponse, status_code=201)
def crear_pago(
    datos: schemas.PaymentCreate,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_token),
):
    existente = payment_repository.obtener_por_idempotencia(db, idempotency_key)
    if existente:
        return _response(existente)

    venta = db.query(models.Venta).filter(models.Venta.id == datos.venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.cliente_id != int(payload["sub"]) and payload.get("rol_id") not in (1, 2):
        raise HTTPException(status_code=403, detail="No tienes permiso para pagar esta venta")
    if venta.estado in ("pagada", "cancelada"):
        raise HTTPException(status_code=409, detail="La venta no admite un nuevo pago")

    pago_pendiente = payment_repository.obtener_pendiente_de_venta(db, venta.id)
    if pago_pendiente:
        return _response(pago_pendiente)

    customer = db.query(models.Usuario).filter(models.Usuario.id == venta.cliente_id).first()
    return respuesta_pago(crear_pago_stripe(db, venta, customer, idempotency_key))


@router.get("/payments/mine", response_model=list[schemas.PaymentResponse])
def listar_mis_pagos(db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    consulta = db.query(models.Payment).join(models.Venta).order_by(models.Payment.created_at.desc())
    if payload.get("rol_id") == 3:
        consulta = consulta.filter(models.Venta.cliente_id == int(payload["sub"]))
    elif payload.get("rol_id") not in (1, 2):
        raise HTTPException(status_code=403, detail="No tienes permiso para ver pagos")
    return [_response(payment) for payment in consulta.all()]


@router.get("/payments/{payment_id}", response_model=schemas.PaymentResponse)
def obtener_pago(payment_id: uuid.UUID, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    if payment.venta.cliente_id != int(payload["sub"]) and payload.get("rol_id") not in (1, 2):
        raise HTTPException(status_code=403, detail="No tienes permiso para ver este pago")
    return _response(payment)


@router.get("/payments/reference/{reference}", response_model=schemas.PaymentResponse)
def obtener_pago_por_referencia(reference: str, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    payment = db.query(models.Payment).filter(models.Payment.reference == reference).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    if payment.venta.cliente_id != int(payload["sub"]) and payload.get("rol_id") not in (1, 2):
        raise HTTPException(status_code=403, detail="No tienes permiso para ver este pago")
    return _response(payment)


@router.post("/payments/{payment_id}/sync", response_model=schemas.PaymentResponse)
def sincronizar_pago(payment_id: uuid.UUID, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    payment = db.query(models.Payment).filter(models.Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    if payment.venta.cliente_id != int(payload["sub"]) and payload.get("rol_id") not in (1, 2):
        raise HTTPException(status_code=403, detail="No tienes permiso para ver este pago")
    if payment.status in {"APPROVED", "DECLINED", "EXPIRED", "VOIDED", "ERROR"}:
        return _response(payment)
    if not payment.provider_transaction_id:
        return _response(payment)
    try:
        session = StripeProvider().obtener_checkout(payment.provider_transaction_id)
    except stripe.StripeError as error:
        raise HTTPException(status_code=502, detail="No fue posible consultar Stripe") from error
    if hasattr(session, "to_dict_recursive"):
        session_data = session.to_dict_recursive()
    elif hasattr(session, "to_dict"):
        session_data = session.to_dict()
    else:
        session_data = dict(session)
    aplicar_estado_pago(db, payment, _status_from_checkout_session(session_data), {"sync": session_data})
    db.commit()
    db.refresh(payment)
    return _response(payment)


@router.post("/webhooks/stripe")
async def webhook_stripe(request: Request, db: Session = Depends(get_db)):
    secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    signature = request.headers.get("stripe-signature")
    if not secret or not signature:
        raise HTTPException(status_code=400, detail="Webhook de Stripe no configurado o firma ausente")
    try:
        event = StripeProvider.validar_webhook(await request.body(), signature, secret)
    except (ValueError, stripe.SignatureVerificationError) as error:
        raise HTTPException(status_code=400, detail="Firma de webhook inválida") from error

    if event["type"] not in {"checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"}:
        return {"received": True}
    event_data = _stripe_dict(event)
    session = _stripe_dict(event_data["data"]["object"])
    payment_id = session.get("metadata", {}).get("payment_id")
    try:
        payment_uuid = uuid.UUID(payment_id) if payment_id else None
    except (ValueError, TypeError, AttributeError):
        payment_uuid = None
    payment = db.query(models.Payment).filter(models.Payment.id == payment_uuid).first() if payment_uuid else None
    if not payment:
        return {"received": True}
    status = _status_from_checkout_session(session, event_data["type"])
    aplicar_estado_pago(db, payment, status, event_data)
    db.commit()
    return {"received": True}
