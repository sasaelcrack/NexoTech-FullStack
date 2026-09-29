from decimal import Decimal

import stripe
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db
from app.integrations.stripe_provider import CheckoutNoCancelableError, StripeProvider
from app.services.payment_service import restaurar_stock_venta


router = APIRouter(prefix="/api/ventas", tags=["Ventas"])
IVA_RATE = Decimal("0.19")


@router.post("/", response_model=schemas.VentaResponse, status_code=201)
def crear_venta(
    datos: schemas.VentaCreate,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_token),
):
    detalles = []
    subtotal = Decimal("0")
    productos = {}

    for producto_id in sorted({item.id for item in datos.items if item.tipo_item == "producto"}):
        producto = (
            db.query(models.Producto)
            .filter(models.Producto.id == producto_id, models.Producto.estado == "activo")
            .with_for_update()
            .first()
        )
        if not producto:
            raise HTTPException(status_code=404, detail=f"Producto {producto_id} no disponible")
        productos[producto_id] = producto

    for item in datos.items:
        if item.tipo_item == "producto":
            articulo = productos[item.id]
            if articulo.stock is not None and articulo.stock < item.cantidad:
                raise HTTPException(status_code=400, detail=f"Stock insuficiente para {articulo.nombre}")
        else:
            articulo = db.query(models.Servicio).filter(
                models.Servicio.id == item.id, models.Servicio.estado == "activo"
            ).first()
            if not articulo:
                raise HTTPException(status_code=404, detail=f"Servicio {item.id} no disponible")

        valor_linea = articulo.precio * item.cantidad
        subtotal += valor_linea
        detalles.append(
            models.DetalleVenta(
                producto_id=articulo.id if item.tipo_item == "producto" else None,
                servicio_id=articulo.id if item.tipo_item == "servicio" else None,
                cantidad=item.cantidad,
                precio_unitario=articulo.precio,
                subtotal=valor_linea,
            )
        )

        if item.tipo_item == "producto" and articulo.stock is not None:
            articulo.stock -= item.cantidad

    descuento = Decimal(str(datos.descuento))
    if descuento > 0 and payload.get("rol_id") not in (1, 2):
        raise HTTPException(status_code=403, detail="Solo el personal autorizado puede aplicar descuentos")
    if descuento > subtotal:
        raise HTTPException(status_code=400, detail="El descuento no puede superar el subtotal")
    base_gravable = subtotal - descuento
    impuestos = (base_gravable * IVA_RATE).quantize(Decimal("0.01"))
    total = base_gravable + impuestos
    if total < 0:
        raise HTTPException(status_code=400, detail="El descuento no puede superar el subtotal más impuestos")

    usuario_id = int(payload["sub"])
    nueva_venta = models.Venta(
        cliente_id=usuario_id,
        usuario_id=usuario_id if payload.get("rol_id") in (1, 2) else None,
        subtotal=subtotal,
        descuento=descuento,
        impuestos=impuestos,
        total=total,
        estado="pendiente",
        detalles=detalles,
    )
    db.add(nueva_venta)
    if payload.get("rol_id") == 3:
        db.query(models.CarritoActivo).filter(
            models.CarritoActivo.usuario_id == usuario_id
        ).delete(synchronize_session=False)
    db.commit()
    db.refresh(nueva_venta)
    return nueva_venta


@router.get("/mias", response_model=list[schemas.VentaResponse])
def listar_mis_ventas(
    db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)
):
    return (
        db.query(models.Venta)
        .filter(models.Venta.cliente_id == int(payload["sub"]))
        .order_by(models.Venta.fecha.desc())
        .all()
    )


@router.get("/", response_model=list[schemas.VentaResponse])
def listar_ventas(
    db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2))
):
    return db.query(models.Venta).order_by(models.Venta.fecha.desc()).all()


@router.get("/{venta_id}", response_model=schemas.VentaResponse)
def obtener_venta(
    venta_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_token),
):
    venta = db.query(models.Venta).filter(models.Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.cliente_id != int(payload["sub"]) and payload.get("rol_id") not in (1, 2):
        raise HTTPException(status_code=403, detail="No tienes permiso para ver esta venta")
    return venta


def _cancelar_venta_pendiente(db: Session, venta: models.Venta):
    if venta.estado != "pendiente":
        raise HTTPException(
            status_code=409,
            detail="Solo puedes cancelar compras pendientes de pago",
        )

    for pago in venta.pagos:
        if pago.status != "PENDING":
            continue
        if pago.provider == "stripe" and pago.provider_transaction_id:
            try:
                StripeProvider().expirar_checkout(pago.provider_transaction_id)
            except CheckoutNoCancelableError as error:
                raise HTTPException(
                    status_code=409,
                    detail="El pago ya fue enviado o procesado y no se puede cancelar todavía",
                ) from error
            except stripe.StripeError as error:
                raise HTTPException(
                    status_code=502,
                    detail="No fue posible confirmar la cancelación del pago con Stripe",
                ) from error
            except RuntimeError as error:
                raise HTTPException(
                    status_code=503,
                    detail="Stripe no está disponible para cancelar el pago",
                ) from error
            pago.status = "EXPIRED"
        else:
            pago.status = "VOIDED"

    restaurar_stock_venta(db, venta)

    venta.estado = "cancelada"
    db.commit()
    db.refresh(venta)
    return venta


@router.post("/{venta_id}/cancelar", response_model=schemas.VentaResponse)
def cancelar_mi_venta(
    venta_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_token),
):
    venta = db.query(models.Venta).filter(models.Venta.id == venta_id).with_for_update().first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.cliente_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="No tienes permiso para cancelar esta venta")
    return _cancelar_venta_pendiente(db, venta)


@router.patch("/{venta_id}/estado", response_model=schemas.VentaResponse)
def cambiar_estado_venta(
    venta_id: int,
    datos: schemas.CambiarEstadoVenta,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_rol(1, 2)),
):
    venta = db.query(models.Venta).filter(models.Venta.id == venta_id).with_for_update().first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    if datos.estado == "cancelada":
        return _cancelar_venta_pendiente(db, venta)
    if datos.estado == "pagada":
        raise HTTPException(status_code=409, detail="El pago solo se confirma mediante Stripe")
    if datos.estado == "completada" and venta.estado not in ("pagada", "completada"):
        raise HTTPException(status_code=409, detail="Solo se puede completar una venta pagada")
    if datos.estado == venta.estado:
        return venta
    if datos.estado != "completada":
        raise HTTPException(status_code=409, detail="Transición de estado no permitida")

    venta.estado = datos.estado
    db.commit()
    db.refresh(venta)
    return venta
