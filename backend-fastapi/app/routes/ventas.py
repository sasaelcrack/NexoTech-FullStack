from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db


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

    for item in datos.items:
        if item.tipo_item == "producto":
            articulo = db.query(models.Producto).filter(
                models.Producto.id == item.id, models.Producto.estado == "activo"
            ).first()
            if not articulo:
                raise HTTPException(status_code=404, detail=f"Producto {item.id} no disponible")
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
    impuestos = (subtotal * IVA_RATE).quantize(Decimal("0.01"))
    total = subtotal - descuento + impuestos
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


@router.post("/{venta_id}/cancelar", response_model=schemas.VentaResponse)
def cancelar_mi_venta(
    venta_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_token),
):
    venta = db.query(models.Venta).filter(models.Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.cliente_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="No tienes permiso para cancelar esta venta")
    if venta.estado != "pendiente":
        raise HTTPException(
            status_code=409,
            detail="Solo puedes cancelar compras pendientes de pago",
        )

    for detalle in venta.detalles:
        if detalle.producto_id:
            producto = db.query(models.Producto).filter(models.Producto.id == detalle.producto_id).first()
            if producto and producto.stock is not None:
                producto.stock += detalle.cantidad

    for pago in venta.pagos:
        if pago.status == "PENDING":
            pago.status = "VOIDED"

    venta.estado = "cancelada"
    db.commit()
    db.refresh(venta)
    return venta


@router.patch("/{venta_id}/estado", response_model=schemas.VentaResponse)
def cambiar_estado_venta(
    venta_id: int,
    datos: schemas.CambiarEstadoVenta,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_rol(1, 2)),
):
    venta = db.query(models.Venta).filter(models.Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    venta.estado = datos.estado
    db.commit()
    db.refresh(venta)
    return venta
