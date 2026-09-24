import hashlib
import logging
import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/api/usuarios", tags=["Usuarios"])
logger = logging.getLogger(__name__)


def _correo_normalizado(correo: str) -> str:
    return correo.strip().lower()


def enviar_correo_recuperacion(destinatario: str, enlace: str) -> None:
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("SMTP_FROM", username)

    if not all((host, username, password, sender)):
        raise RuntimeError("SMTP no está configurado")

    mensaje = EmailMessage()
    mensaje["Subject"] = "Recuperación de contraseña - NexoTech"
    mensaje["From"] = sender
    mensaje["To"] = destinatario
    mensaje.set_content(
        "Solicitaste restablecer tu contraseña de NexoTech. "
        f"El enlace es válido durante 30 minutos:\n\n{enlace}\n\n"
        "Si no solicitaste este cambio, puedes ignorar este correo."
    )

    with smtplib.SMTP(host, port) as servidor:
        servidor.starttls()
        servidor.login(username, password)
        servidor.send_message(mensaje)


@router.post("/registro", response_model=schemas.UsuarioResponse)
def registrar_usuario(
    usuario: schemas.UsuarioCreate,
    db: Session = Depends(get_db),
    _limite: None = Depends(auth.limitar_solicitudes),
):
    correo = _correo_normalizado(usuario.correo)
    existe = db.query(models.Usuario).filter(func.lower(models.Usuario.correo) == correo).first()
    if existe:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    documento_existe = db.query(models.Usuario).filter(
        models.Usuario.numero_documento == usuario.numero_documento
    ).first()
    if documento_existe:
        raise HTTPException(status_code=400, detail="El número de documento ya está registrado")

    nuevo_usuario = models.Usuario(
        nombre=usuario.nombre,
        apellido=usuario.apellido,
        tipo_documento=usuario.tipo_documento,
        numero_documento=usuario.numero_documento,
        direccion=usuario.direccion,
        correo=correo,
        telefono=usuario.telefono,
        password_hash=auth.hashear_password(usuario.password),
        rol_id=3,
        estado="activo",
    )
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return nuevo_usuario


@router.post("/login")
def login(
    datos: schemas.UsuarioLogin,
    db: Session = Depends(get_db),
    _limite: None = Depends(auth.limitar_solicitudes),
):
    usuario = db.query(models.Usuario).filter(
        func.lower(models.Usuario.correo) == _correo_normalizado(datos.correo)
    ).first()
    if (
        not usuario
        or usuario.estado != "activo"
        or not auth.verificar_password(datos.password, usuario.password_hash)
    ):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")

    token = auth.crear_token({"sub": str(usuario.id), "rol_id": usuario.rol_id})
    return {"token": token, "usuario": {"id": usuario.id, "rol_id": usuario.rol_id}}


@router.post("/recuperar")
def solicitar_recuperacion(
    datos: schemas.RecuperarPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _limite: None = Depends(auth.limitar_solicitudes),
):
    mensaje_generico = {"mensaje": "Si el correo existe, recibirás un enlace de recuperación."}
    usuario = db.query(models.Usuario).filter(
        func.lower(models.Usuario.correo) == _correo_normalizado(datos.correo)
    ).first()
    if not usuario:
        return mensaje_generico

    token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expiracion = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=30)

    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.usuario_id == usuario.id,
        models.PasswordResetToken.used_at.is_(None),
    ).update({"used_at": datetime.now(timezone.utc).replace(tzinfo=None)})
    db.add(models.PasswordResetToken(usuario_id=usuario.id, token_hash=token_hash, expires_at=expiracion))

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    enlace = f"{frontend_url}/restablecer-password?token={token}"
    db.commit()
    if background_tasks is not None:
        background_tasks.add_task(enviar_correo_recuperacion, usuario.correo, enlace)
    else:
        try:
            enviar_correo_recuperacion(usuario.correo, enlace)
        except (OSError, smtplib.SMTPException, RuntimeError):
            logger.warning("No fue posible enviar un correo de recuperación")
    return mensaje_generico


@router.post("/restablecer")
def restablecer_password(
    datos: schemas.RestablecerPasswordRequest,
    db: Session = Depends(get_db),
    _limite: None = Depends(auth.limitar_solicitudes),
):
    token_hash = hashlib.sha256(datos.token.encode()).hexdigest()
    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    registro = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.token_hash == token_hash,
        models.PasswordResetToken.used_at.is_(None),
        models.PasswordResetToken.expires_at > ahora,
    ).first()
    if not registro:
        raise HTTPException(status_code=400, detail="El enlace no es válido o ya expiró")

    usuario = db.query(models.Usuario).filter(models.Usuario.id == registro.usuario_id).first()
    usuario.password_hash = auth.hashear_password(datos.password)
    registro.used_at = ahora
    db.commit()
    return {"mensaje": "Contraseña actualizada correctamente"}

@router.get("/perfil")
def perfil(payload: dict = Depends(auth.verificar_token)):
    return {"mensaje": "Token válido", "datos": payload}


@router.get("/solo-admin")
def solo_admin(payload: dict = Depends(auth.verificar_rol(1))):
    return {"mensaje": "Bienvenido, admin", "datos": payload}


@router.get("/referencias")
def referencias_usuarios(
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_rol(1, 2)),
):
    """Datos mínimos para identificar clientes en ventas y facturas."""
    return [
        {"id": usuario.id, "nombre": usuario.nombre, "apellido": usuario.apellido, "correo": usuario.correo}
        for usuario in db.query(models.Usuario).filter(models.Usuario.rol_id == 3).order_by(models.Usuario.id).all()
    ]


@router.get("/", response_model=list[schemas.UsuarioResponse])
def listar_usuarios(db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1))):
    return db.query(models.Usuario).all()


@router.get("/me", response_model=schemas.UsuarioResponse)
def obtener_mi_perfil(db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)):
    usuario = db.query(models.Usuario).filter(models.Usuario.id == int(payload["sub"])).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return usuario


@router.put("/me", response_model=schemas.UsuarioResponse)
def editar_mi_perfil(
    datos: schemas.UsuarioUpdate,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_token),
):
    usuario = db.query(models.Usuario).filter(models.Usuario.id == int(payload["sub"])).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    datos_dict = datos.model_dump(exclude_unset=True)
    datos_dict.pop("rol_id", None)   # nadie se cambia el rol a sí mismo
    datos_dict.pop("estado", None)   # ni su propio estado

    for campo, valor in datos_dict.items():
        setattr(usuario, campo, valor)

    db.commit()
    db.refresh(usuario)
    return usuario

@router.get("/{usuario_id}", response_model=schemas.UsuarioResponse)
def obtener_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_rol(1))
):
    usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return usuario


@router.put("/{usuario_id}", response_model=schemas.UsuarioResponse)
def editar_usuario(usuario_id: int, datos: schemas.UsuarioUpdate, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1))):
    usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(usuario, campo, valor)

    db.commit()
    db.refresh(usuario)
    return usuario


@router.patch("/{usuario_id}/estado", response_model=schemas.UsuarioResponse)
def cambiar_estado(usuario_id: int, datos: schemas.CambiarEstado, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1))):
    usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if usuario.rol_id == 1 and usuario.estado == "activo" and datos.estado == "inactivo":
        admins_activos = db.query(models.Usuario).filter(
            models.Usuario.rol_id == 1, models.Usuario.estado == "activo"
        ).count()
        if admins_activos <= 1:
            raise HTTPException(status_code=409, detail="Debe existir al menos un administrador activo")
    usuario.estado = datos.estado
    db.commit()
    db.refresh(usuario)
    return usuario


@router.patch("/{usuario_id}/rol", response_model=schemas.UsuarioResponse)
def cambiar_rol_usuario(
    usuario_id: int,
    datos: schemas.CambiarRol,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_rol(1)),
):
    usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    rol = db.query(models.Rol).filter(models.Rol.id == datos.rol_id).first()
    if not rol:
        raise HTTPException(status_code=400, detail="El rol seleccionado no existe")
    if usuario.rol_id == 1 and datos.rol_id != 1 and usuario.estado == "activo":
        admins_activos = db.query(models.Usuario).filter(
            models.Usuario.rol_id == 1, models.Usuario.estado == "activo"
        ).count()
        if admins_activos <= 1:
            raise HTTPException(status_code=409, detail="Debe existir al menos un administrador activo")
    usuario.rol_id = datos.rol_id
    db.commit()
    db.refresh(usuario)
    return usuario


@router.delete("/{usuario_id}")
def eliminar_usuario(usuario_id: int, db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1))):
    usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if usuario.id == int(payload["sub"]):
        raise HTTPException(status_code=409, detail="No puedes eliminar tu propio usuario administrador")

    pedidos = db.query(models.Pedido).filter(models.Pedido.usuario_id == usuario_id).count()
    ventas = db.query(models.Venta).filter(models.Venta.cliente_id == usuario_id).count()
    pqr = db.query(models.PQR).filter(models.PQR.cliente_id == usuario_id).count()
    conversaciones = db.query(models.Conversacion).filter(models.Conversacion.usuario_id == usuario_id).count()
    if pedidos or ventas or pqr or conversaciones:
        raise HTTPException(
            status_code=409,
            detail=(
                "No se puede eliminar el usuario porque tiene información histórica asociada. "
                "Cambia su estado a inactivo para conservar el historial."
            ),
        )

    db.delete(usuario)
    db.commit()
    return {"mensaje": "Usuario eliminado correctamente"}
