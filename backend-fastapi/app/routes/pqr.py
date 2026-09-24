from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db

router = APIRouter(prefix="/api/pqr", tags=["PQR"])


def _obtener_pqr_autorizada(pqr_id: int, db: Session, payload: dict):
    pqr = db.query(models.PQR).filter(models.PQR.id == pqr_id).first()
    if not pqr:
        raise HTTPException(status_code=404, detail="PQR no encontrada")
    if pqr.cliente_id != int(payload["sub"]) and payload.get("rol_id") not in (1, 2):
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a esta PQR")
    return pqr


@router.post("/", response_model=schemas.PQRResponse, status_code=201)
def crear_pqr(datos: schemas.PQRCreate, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    pqr = models.PQR(cliente_id=int(payload["sub"]), asunto=datos.asunto.strip(), descripcion=datos.descripcion.strip())
    db.add(pqr)
    db.commit()
    db.refresh(pqr)
    return pqr


@router.get("/mias", response_model=list[schemas.PQRResponse])
def listar_mis_pqr(db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    return db.query(models.PQR).filter(models.PQR.cliente_id == int(payload["sub"])).order_by(models.PQR.fecha_creacion.desc()).all()


@router.get("/", response_model=list[schemas.PQRResponse])
def listar_pqr(db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2))):
    return db.query(models.PQR).order_by(models.PQR.fecha_creacion.desc()).all()


@router.get("/{pqr_id}", response_model=schemas.PQRResponse)
def obtener_pqr(pqr_id: int, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    return _obtener_pqr_autorizada(pqr_id, db, payload)


@router.put("/{pqr_id}", response_model=schemas.PQRResponse)
def actualizar_pqr(pqr_id: int, datos: schemas.PQRUpdate, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    pqr = _obtener_pqr_autorizada(pqr_id, db, payload)
    if pqr.cliente_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="Solo el cliente puede editar su PQR")
    if pqr.estado != "abierta":
        raise HTTPException(status_code=409, detail="Solo se pueden editar PQR abiertas")
    pqr.asunto = datos.asunto.strip()
    pqr.descripcion = datos.descripcion.strip()
    db.commit()
    db.refresh(pqr)
    return pqr


@router.patch("/{pqr_id}/respuesta", response_model=schemas.PQRResponse)
def responder_pqr(pqr_id: int, datos: schemas.PQRRespuesta, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2))):
    pqr = _obtener_pqr_autorizada(pqr_id, db, payload)
    pqr.respuesta = datos.respuesta.strip()
    pqr.estado = datos.estado
    pqr.fecha_respuesta = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pqr)
    return pqr
