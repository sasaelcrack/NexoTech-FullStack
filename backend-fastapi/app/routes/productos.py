import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from app.integrations.cloudinary_images import (
    ImageStorageError,
    ImageStorageNotConfigured,
    MAX_IMAGE_BYTES,
    eliminar_imagen_producto,
    subir_imagen_producto,
    validar_imagen,
)


router = APIRouter(prefix="/api/productos", tags=["Productos"])
logger = logging.getLogger(__name__)


@router.get("/", response_model=list[schemas.ProductoResponse])
def listar_productos(db: Session = Depends(get_db)):
    return db.query(models.Producto).filter(models.Producto.estado == "activo").order_by(models.Producto.id.asc()).all()


@router.get("/gestion", response_model=list[schemas.ProductoResponse])
def listar_productos_gestion(
    db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2))
):
    return db.query(models.Producto).order_by(models.Producto.id.asc()).all()

@router.get("/{producto_id}", response_model=schemas.ProductoResponse)
def obtener_producto(producto_id: int, db: Session = Depends(get_db)):
    item = db.query(models.Producto).filter(
        models.Producto.id == producto_id, models.Producto.estado == "activo"
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return item


@router.post("/{producto_id}/imagen", response_model=schemas.ProductoResponse)
async def cargar_imagen_producto(
    producto_id: int,
    imagen: UploadFile = File(...),
    db: Session = Depends(get_db),
    _payload: dict = Depends(auth.verificar_rol(1)),
):
    item = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    content = await imagen.read(MAX_IMAGE_BYTES + 1)
    try:
        image_format = validar_imagen(imagen.content_type, content)
        stored_image = subir_imagen_producto(producto_id, content, image_format)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except ImageStorageNotConfigured as error:
        raise HTTPException(status_code=503, detail="Configura Cloudinary en el backend para subir imágenes") from error
    except ImageStorageError as error:
        logger.warning("Cloudinary product image upload failed for product %s", producto_id)
        raise HTTPException(status_code=502, detail="No fue posible guardar la imagen del producto") from error

    item.imagen_url = stored_image["url"]
    item.imagen_public_id = stored_image["public_id"]
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{producto_id}/imagen", response_model=schemas.ProductoResponse)
def quitar_imagen_producto(
    producto_id: int,
    db: Session = Depends(get_db),
    _payload: dict = Depends(auth.verificar_rol(1)),
):
    item = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if not item.imagen_public_id:
        return item

    try:
        eliminar_imagen_producto(item.imagen_public_id)
    except ImageStorageNotConfigured as error:
        raise HTTPException(status_code=503, detail="Configura Cloudinary en el backend para quitar imágenes") from error
    except ImageStorageError as error:
        logger.warning("Cloudinary product image deletion failed for product %s", producto_id)
        raise HTTPException(status_code=502, detail="No fue posible quitar la imagen del producto") from error

    item.imagen_url = None
    item.imagen_public_id = None
    db.commit()
    db.refresh(item)
    return item

@router.post("/", response_model=schemas.ProductoResponse)
def crear_producto(producto: schemas.ProductoBase, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2))):
    nuevo = models.Producto(**producto.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.put("/{producto_id}", response_model=schemas.ProductoResponse)
def editar_producto(producto_id: int, producto: schemas.ProductoBase, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2))):
    item = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    for campo, valor in producto.model_dump().items():
        setattr(item, campo, valor)

    db.commit()
    db.refresh(item)
    return item


@router.patch("/{producto_id}/estado", response_model=schemas.ProductoResponse)
def cambiar_estado_producto(
    producto_id: int,
    datos: schemas.CambiarEstado,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_rol(1, 2)),
):
    item = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    item.estado = datos.estado
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{producto_id}")
def eliminar_producto(producto_id: int, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2))):
    item = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    ventas = (
        db.query(models.DetallePedido).filter(models.DetallePedido.producto_id == producto_id).count()
        + db.query(models.DetalleVenta).filter(models.DetalleVenta.producto_id == producto_id).count()
        + db.query(models.DetalleFactura).filter(models.DetalleFactura.producto_id == producto_id).count()
    )
    if ventas:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No se puede eliminar el producto porque tiene {ventas} venta(s) registrada(s). "
                "Cambia su estado a inactivo para conservar el historial."
            ),
        )

    if item.imagen_public_id:
        try:
            eliminar_imagen_producto(item.imagen_public_id)
        except ImageStorageNotConfigured as error:
            raise HTTPException(status_code=503, detail="Configura Cloudinary antes de eliminar este producto") from error
        except ImageStorageError as error:
            raise HTTPException(status_code=502, detail="No fue posible eliminar la imagen del producto") from error

    db.delete(item)
    db.commit()
    return {"mensaje": "Producto eliminado correctamente"}
