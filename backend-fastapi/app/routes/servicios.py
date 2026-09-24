from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from pydantic import BaseModel

router = APIRouter(prefix="/api/servicios", tags=["Servicios"])


@router.get("/", response_model=list[schemas.ServicioResponse])
def listar_servicios(db: Session = Depends(get_db)):
    return db.query(models.Servicio).filter(models.Servicio.estado == "activo").order_by(models.Servicio.id.asc()).all()


@router.get("/gestion", response_model=list[schemas.ServicioResponse])
def listar_servicios_gestion(
    db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2))
):
    return db.query(models.Servicio).order_by(models.Servicio.id.asc()).all()

@router.get("/{servicio_id}", response_model=schemas.ServicioResponse)
def obtener_servicio(servicio_id: int, db: Session = Depends(get_db)):
    item = db.query(models.Servicio).filter(
        models.Servicio.id == servicio_id, models.Servicio.estado == "activo"
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    return item

@router.post("/", response_model=schemas.ServicioResponse)
def crear_servicio(servicio: schemas.ServicioBase, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2))):
    nuevo = models.Servicio(**servicio.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.put("/{servicio_id}", response_model=schemas.ServicioResponse)
def editar_servicio(servicio_id: int, servicio: schemas.ServicioBase, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2))):
    item = db.query(models.Servicio).filter(models.Servicio.id == servicio_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    for campo, valor in servicio.model_dump().items():
        setattr(item, campo, valor)

    db.commit()
    db.refresh(item)
    return item


@router.patch("/{servicio_id}/estado", response_model=schemas.ServicioResponse)
def cambiar_estado_servicio(
    servicio_id: int,
    datos: schemas.CambiarEstado,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_rol(1, 2)),
):
    item = db.query(models.Servicio).filter(models.Servicio.id == servicio_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    item.estado = datos.estado
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{servicio_id}")
def eliminar_servicio(servicio_id: int, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2))):
    item = db.query(models.Servicio).filter(models.Servicio.id == servicio_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    ventas = (
        db.query(models.DetallePedido).filter(models.DetallePedido.servicio_id == servicio_id).count()
        + db.query(models.DetalleVenta).filter(models.DetalleVenta.servicio_id == servicio_id).count()
        + db.query(models.DetalleFactura).filter(models.DetalleFactura.servicio_id == servicio_id).count()
    )
    if ventas:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No se puede eliminar el servicio porque tiene {ventas} venta(s) registrada(s). "
                "Cambia su estado a inactivo para conservar el historial."
            ),
        )

    db.delete(item)
    db.commit()
    return {"mensaje": "Servicio eliminado correctamente"}
