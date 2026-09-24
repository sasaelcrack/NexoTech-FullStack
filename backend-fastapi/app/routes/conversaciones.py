from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db

router = APIRouter(prefix="/api/conversaciones", tags=["Conversaciones"])


def _obtener_autorizada(conversacion_id: int, db: Session, payload: dict):
    conversacion = db.query(models.Conversacion).filter(models.Conversacion.id == conversacion_id).first()
    if not conversacion:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    if conversacion.usuario_id != int(payload["sub"]) and payload.get("rol_id") not in (1, 2):
        raise HTTPException(status_code=403, detail="No tienes permiso para acceder a esta conversación")
    return conversacion


@router.post("/", response_model=schemas.ConversacionResponse, status_code=201)
def crear_conversacion(datos: schemas.ConversacionCreate, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    conversacion = models.Conversacion(
        usuario_id=int(payload["sub"]),
        mensajes=[models.Mensaje(remitente="cliente", mensaje=datos.mensaje.strip())],
    )
    db.add(conversacion)
    db.commit()
    db.refresh(conversacion)
    return conversacion


@router.get("/mias", response_model=list[schemas.ConversacionResponse])
def listar_mis_conversaciones(db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    return db.query(models.Conversacion).filter(models.Conversacion.usuario_id == int(payload["sub"])).order_by(models.Conversacion.fecha_inicio.desc()).all()


@router.get("/", response_model=list[schemas.ConversacionResponse])
def listar_conversaciones_soporte(db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2))):
    return db.query(models.Conversacion).order_by(models.Conversacion.fecha_inicio.desc()).all()


@router.get("/{conversacion_id}", response_model=schemas.ConversacionResponse)
def obtener_conversacion(conversacion_id: int, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    return _obtener_autorizada(conversacion_id, db, payload)


@router.post("/{conversacion_id}/mensajes", response_model=schemas.MensajeResponse, status_code=201)
def enviar_mensaje(conversacion_id: int, datos: schemas.MensajeCreate, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    conversacion = _obtener_autorizada(conversacion_id, db, payload)
    remitente = "cliente" if payload.get("rol_id") == 3 else "soporte"
    mensaje = models.Mensaje(conversacion_id=conversacion.id, remitente=remitente, mensaje=datos.mensaje.strip())
    db.add(mensaje)
    db.commit()
    db.refresh(mensaje)
    return mensaje
