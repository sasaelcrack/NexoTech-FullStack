import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/api/pedidos", tags=["Pedidos"])


@router.post("/", response_model=schemas.PedidoResponse)
def crear_pedido(datos: schemas.PedidoCreate, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    usuario_id = int(payload["sub"])
    detalles = []
    total = Decimal("0")
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
            obj = productos[item.id]
            if obj.stock is not None and obj.stock < item.cantidad:
                raise HTTPException(status_code=400, detail=f"Stock insuficiente para {obj.nombre}")
        else:
            obj = db.query(models.Servicio).filter(
                models.Servicio.id == item.id, models.Servicio.estado == "activo"
            ).first()
            if not obj:
                raise HTTPException(status_code=404, detail=f"Servicio {item.id} no disponible")

        total += Decimal(obj.precio) * item.cantidad

        detalles.append(models.DetallePedido(
            tipo_item=item.tipo_item,
            producto_id=obj.id if item.tipo_item == "producto" else None,
            servicio_id=obj.id if item.tipo_item == "servicio" else None,
            nombre_item=obj.nombre,
            cantidad=item.cantidad,
            precio_unitario=obj.precio,
        ))

        if item.tipo_item == "producto" and obj.stock is not None:
            obj.stock -= item.cantidad

    nuevo_pedido = models.Pedido(
        usuario_id=usuario_id,
        total=total,
        estado="pendiente",
        referencia_pago=f"NT-{uuid.uuid4().hex[:10].upper()}",
        detalles=detalles,
    )
    db.add(nuevo_pedido)
    db.commit()
    db.refresh(nuevo_pedido)
    return nuevo_pedido


@router.get("/mios", response_model=list[schemas.PedidoResponse])
def mis_pedidos(db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    usuario_id = int(payload["sub"])
    return (
        db.query(models.Pedido)
        .filter(models.Pedido.usuario_id == usuario_id)
        .order_by(models.Pedido.fecha_creacion.desc())
        .all()
    )


@router.get("/{pedido_id}", response_model=schemas.PedidoResponse)
def obtener_pedido(pedido_id: int, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    pedido = db.query(models.Pedido).filter(models.Pedido.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if pedido.usuario_id != int(payload["sub"]) and payload.get("rol_id") not in (1, 2):
        raise HTTPException(status_code=403, detail="No tienes permiso para ver este pedido")
    return pedido


@router.get("/", response_model=list[schemas.PedidoResponse])
def listar_pedidos(db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2))):
    return db.query(models.Pedido).order_by(models.Pedido.fecha_creacion.desc()).all()


@router.patch("/{pedido_id}/estado", response_model=schemas.PedidoResponse)
def cambiar_estado_pedido(
    pedido_id: int,
    datos: schemas.CambiarEstadoPedido,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_rol(1, 2)),
):
    pedido = db.query(models.Pedido).filter(models.Pedido.id == pedido_id).with_for_update().first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    if pedido.estado == datos.estado:
        return pedido
    if pedido.estado != "pendiente":
        raise HTTPException(status_code=409, detail="No se puede cambiar el estado de un pedido finalizado")

    if datos.estado in ("fallido", "cancelado"):
        cantidades_por_producto = {}
        for detalle in pedido.detalles:
            if detalle.tipo_item == "producto" and detalle.producto_id:
                cantidades_por_producto[detalle.producto_id] = (
                    cantidades_por_producto.get(detalle.producto_id, 0) + detalle.cantidad
                )
        for producto_id in sorted(cantidades_por_producto):
            producto = (
                db.query(models.Producto)
                .filter(models.Producto.id == producto_id)
                .with_for_update()
                .first()
            )
            if producto and producto.stock is not None:
                producto.stock += cantidades_por_producto[producto_id]

    pedido.estado = datos.estado
    db.commit()
    db.refresh(pedido)
    return pedido