import os
import uuid
from decimal import Decimal

import stripe
from fastapi import HTTPException

from app import models
from app.integrations.stripe_provider import StripeProvider
from app.repositories import payment_repository


PAYMENT_TRANSITIONS = {
    "PENDING": {"PENDING", "APPROVED", "DECLINED", "VOIDED", "ERROR", "EXPIRED"},
    "APPROVED": {"APPROVED"}, "DECLINED": {"DECLINED"}, "VOIDED": {"VOIDED"},
    "ERROR": {"ERROR"}, "EXPIRED": {"EXPIRED"},
}


def restaurar_stock_venta(db, venta: models.Venta) -> None:
    for detalle in venta.detalles:
        if not detalle.producto_id:
            continue
        producto = (
            db.query(models.Producto)
            .filter(models.Producto.id == detalle.producto_id)
            .with_for_update()
            .first()
        )
        if producto and producto.stock is not None:
            producto.stock += detalle.cantidad


def respuesta_pago(payment: models.Payment) -> dict:
    return {
        "id": str(payment.id), "venta_id": payment.venta_id,
        "reference": payment.reference, "provider": payment.provider,
        "provider_transaction_id": payment.provider_transaction_id,
        "amount": float(payment.amount), "currency": payment.currency,
        "status": payment.status, "checkout_url": payment.checkout_url,
    }


def _url_retorno_stripe(payment: models.Payment, tipo: str) -> str:
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
    variable = "STRIPE_SUCCESS_URL" if tipo == "success" else "STRIPE_CANCEL_URL"
    ruta = os.getenv(variable) or f"{frontend_url}/cliente"
    separador = "&" if "?" in ruta else "?"
    parametros = f"payment={tipo}&payment_id={payment.id}"
    if tipo == "success":
        parametros += "&session_id={CHECKOUT_SESSION_ID}"
    return f"{ruta}{separador}{parametros}"


def _linea_checkout(venta: models.Venta, resumen: str) -> list[dict]:
    subtotal = getattr(venta, "subtotal", None)
    descuento = getattr(venta, "descuento", Decimal("0")) or Decimal("0")
    impuestos = getattr(venta, "impuestos", None)
    if subtotal is None or impuestos is None:
        descripcion = resumen[:500]
    else:
        formato_cop = lambda valor: f"${int(Decimal(valor)):,.0f}".replace(",", ".")
        desglose = (
            f"Subtotal: {formato_cop(subtotal)} COP | "
            f"Descuento: -{formato_cop(descuento)} COP | "
            f"IVA (19%): {formato_cop(impuestos)} COP | "
            f"Total: {formato_cop(venta.total)} COP"
        )
        descripcion = f"{resumen[:220]} | {desglose}"[:500]
    return [{
        "price_data": {
            "currency": "cop",
            "product_data": {
                "name": f"Compra NexoTech #{venta.id}",
                "description": descripcion,
            },
            "unit_amount": int(Decimal(venta.total) * 100),
        },
        "quantity": 1,
    }]


def crear_pago_stripe(db, venta: models.Venta, customer: models.Usuario, idempotency_key: str) -> models.Payment:
    existente = payment_repository.obtener_por_idempotencia(db, idempotency_key)
    if existente:
        return existente
    pendiente = payment_repository.obtener_pendiente_de_venta(db, venta.id)
    if pendiente:
        return pendiente
    if Decimal(venta.total) < Decimal("2000"):
        raise HTTPException(
            status_code=400,
            detail="El total mínimo para pagar en Stripe es de $2.000 COP. Crea una nueva venta con precios en pesos colombianos.",
        )

    payment = models.Payment(
        venta_id=venta.id, reference=f"NXT-{venta.id}-{uuid.uuid4().hex[:12].upper()}",
        idempotency_key=idempotency_key, provider="stripe", amount=venta.total, currency="COP",
        status="PENDING", customer_email=customer.correo,
        customer_name=f"{customer.nombre} {customer.apellido}",
    )
    db.add(payment)
    db.flush()
    nombres_items = []
    for detail in venta.detalles:
        item = db.query(models.Producto if detail.producto_id else models.Servicio).filter_by(
            id=detail.producto_id or detail.servicio_id
        ).first()
        nombres_items.append(f"{detail.cantidad}x {item.nombre}")
    line_items = _linea_checkout(venta, ", ".join(nombres_items))
    try:
        session = StripeProvider().crear_checkout(
            mode="payment", customer_email=customer.correo, line_items=line_items,
            success_url=_url_retorno_stripe(payment, "success"),
            cancel_url=_url_retorno_stripe(payment, "cancelled"),
            client_reference_id=payment.reference,
            metadata={"payment_id": str(payment.id), "venta_id": str(venta.id)},
            payment_intent_data={"metadata": {"payment_id": str(payment.id), "venta_id": str(venta.id)}},
        )
    except stripe.InvalidRequestError as error:
        db.rollback()
        if getattr(error, "code", None) == "amount_too_small":
            raise HTTPException(
                status_code=400,
                detail="El total de la venta está por debajo del mínimo permitido por Stripe.",
            ) from error
        raise HTTPException(status_code=502, detail="Stripe rechazó los datos del Checkout") from error
    except (stripe.StripeError, RuntimeError) as error:
        db.rollback()
        raise HTTPException(status_code=502, detail="No fue posible crear el Checkout de Stripe") from error
    payment.provider_transaction_id = session.id
    payment.checkout_url = session.url
    payment.raw_response = {"session_id": session.id, "payment_status": session.payment_status}
    db.commit()
    db.refresh(payment)
    return payment


def _crear_factura_si_no_existe(db, venta: models.Venta) -> None:
    """La factura nace de una venta aprobada, una sola vez."""
    if venta.factura:
        return
    db.add(models.Factura(
        venta_id=venta.id, numero_factura=f"NXT-{venta.id:08d}", cliente_id=venta.cliente_id,
        subtotal=venta.subtotal, descuento=venta.descuento,
        impuestos=venta.impuestos, total=venta.total, estado="emitida",
        detalles=[models.DetalleFactura(producto_id=d.producto_id, servicio_id=d.servicio_id, cantidad=d.cantidad,
            precio_unitario=d.precio_unitario, subtotal=d.subtotal) for d in venta.detalles],
    ))


def aplicar_estado_pago(db, payment: models.Payment, status: str, event: dict | None = None) -> bool:
    """Aplica transiciones válidas y mantiene venta/factura consistentes."""
    status = status.upper()
    if payment.venta.estado == "cancelada":
        return False
    if status not in PAYMENT_TRANSITIONS.get(payment.status, set()):
        return False
    payment.status = status
    if event is not None:
        payment.webhook_payload = event
    if status == "APPROVED":
        payment.venta.estado = "pagada"
        _crear_factura_si_no_existe(db, payment.venta)
    elif status in {"DECLINED", "EXPIRED", "VOIDED", "ERROR"} and payment.venta.estado == "pendiente":
        restaurar_stock_venta(db, payment.venta)
        payment.venta.estado = "cancelada"
    return True
