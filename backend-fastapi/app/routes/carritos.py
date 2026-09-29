from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db


router = APIRouter(prefix="/api/carritos", tags=["Carritos"])
IVA_RATE = Decimal("0.19")
HORAS_CARRITO_ACTIVO = 24


def _materializar_carrito(db: Session, carrito: models.CarritoActivo | None, usuario: models.Usuario):
    subtotal = Decimal("0")
    items = []
    for item_guardado in (carrito.items if carrito else []):
        es_producto = item_guardado["tipo_item"] == "producto"
        modelo = models.Producto if es_producto else models.Servicio
        articulo = db.query(modelo).filter(modelo.id == item_guardado["id"]).first()
        cantidad = int(item_guardado["cantidad"])
        if articulo:
            precio = Decimal(articulo.precio)
            stock = articulo.stock if es_producto else None
            disponible = articulo.estado == "activo" and (stock is None or stock >= cantidad)
            nombre = articulo.nombre
            imagen_url = articulo.imagen_url if es_producto else None
            if disponible:
                subtotal += precio * cantidad
        else:
            precio = Decimal("0")
            stock = 0 if es_producto else None
            disponible = False
            nombre = "Artículo eliminado"
            imagen_url = None
        items.append({
            "tipo_item": "producto" if es_producto else "servicio",
            "id": item_guardado["id"],
            "nombre": nombre,
            "imagen_url": imagen_url,
            "cantidad": cantidad,
            "precio": float(precio),
            "subtotal": float(precio * cantidad),
            "disponible": disponible,
            "stock": stock,
        })
    impuestos = (subtotal * IVA_RATE).quantize(Decimal("0.01"))
    actualizado = carrito.actualizado_en if carrito else None
    return {
        "usuario_id": usuario.id,
        "cliente_nombre": f"{usuario.nombre} {usuario.apellido}",
        "cliente_correo": usuario.correo,
        "actualizado_en": actualizado,
        "items": items,
        "subtotal": float(subtotal),
        "impuestos": float(impuestos),
        "total_estimado": float(subtotal + impuestos),
    }


@router.get("/mio", response_model=schemas.CarritoResponse)
def obtener_mi_carrito(
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_rol(3)),
):
    usuario_id = int(payload["sub"])
    usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    carrito = db.query(models.CarritoActivo).filter(models.CarritoActivo.usuario_id == usuario_id).first()
    return _materializar_carrito(db, carrito, usuario)


@router.put("/mio", response_model=schemas.CarritoResponse)
def guardar_mi_carrito(
    datos: schemas.CarritoSync,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_rol(3)),
):
    usuario_id = int(payload["sub"])
    usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=401, detail="La cuenta ya no está disponible")

    contenido = []
    for item in datos.items:
        modelo = models.Producto if item.tipo_item == "producto" else models.Servicio
        articulo = db.query(modelo).filter(modelo.id == item.id).with_for_update().first()
        if not articulo or articulo.estado != "activo":
            # Keep an existing draft item visible when staff disables it; checkout will reject it.
            existing = db.query(models.CarritoActivo).filter(models.CarritoActivo.usuario_id == usuario_id).first()
            existing_ids = {
                (saved["tipo_item"], saved["id"]) for saved in (existing.items if existing else [])
            }
            if (item.tipo_item, item.id) not in existing_ids:
                raise HTTPException(status_code=409, detail=f"El artículo {item.id} ya no está disponible")
        contenido.append({"tipo_item": item.tipo_item, "id": item.id, "cantidad": item.cantidad})

    carrito = db.query(models.CarritoActivo).filter(models.CarritoActivo.usuario_id == usuario_id).first()
    if not contenido:
        if carrito:
            db.delete(carrito)
        db.commit()
        return _materializar_carrito(db, None, usuario)

    if not carrito:
        carrito = models.CarritoActivo(usuario_id=usuario_id, items=contenido)
        db.add(carrito)
    else:
        carrito.items = contenido
        carrito.actualizado_en = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(carrito)
    return _materializar_carrito(db, carrito, usuario)


@router.get("/activos", response_model=list[schemas.CarritoResponse])
def listar_carritos_activos(
    db: Session = Depends(get_db),
    _payload: dict = Depends(auth.verificar_rol(1, 2)),
):
    limite = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=HORAS_CARRITO_ACTIVO)
    carritos = (
        db.query(models.CarritoActivo)
        .filter(models.CarritoActivo.actualizado_en >= limite)
        .order_by(models.CarritoActivo.actualizado_en.desc())
        .all()
    )
    resultados = []
    for carrito in carritos:
        usuario = db.query(models.Usuario).filter(models.Usuario.id == carrito.usuario_id).first()
        if usuario and usuario.estado == "activo" and carrito.items:
            resultados.append(_materializar_carrito(db, carrito, usuario))
    return resultados
