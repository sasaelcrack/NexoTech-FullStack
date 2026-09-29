import os
import time
import threading
from collections import OrderedDict, deque
from datetime import datetime, timedelta, timezone
import bcrypt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app import models

http_bearer = HTTPBearer()

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = os.getenv("JWT_ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = 60
_request_windows: OrderedDict[tuple[str, str], deque[float]] = OrderedDict()
_MAX_REQUEST_WINDOW_KEYS = 10_000
_request_windows_lock = threading.Lock()


def limitar_solicitudes(request: Request) -> None:
    """Limita endpoints públicos sensibles por IP para frenar abuso básico."""
    limites = {
        "/api/usuarios/login": (5, 60),
        "/api/usuarios/recuperar": (3, 300),
        "/api/usuarios/restablecer": (5, 300),
        "/api/chatbot/mensaje": (30, 60),
    }
    limite, ventana = limites.get(request.url.path, (120, 60))
    ahora = time.monotonic()
    clave = (request.client.host if request.client else "unknown", request.url.path)
    with _request_windows_lock:
        solicitudes = _request_windows.setdefault(clave, deque())
        _request_windows.move_to_end(clave)
        while solicitudes and ahora - solicitudes[0] >= ventana:
            solicitudes.popleft()
        if len(solicitudes) >= limite:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiadas solicitudes. Intenta nuevamente más tarde.",
                headers={"Retry-After": str(ventana)},
            )
        solicitudes.append(ahora)
        if len(_request_windows) > _MAX_REQUEST_WINDOW_KEYS:
            _request_windows.popitem(last=False)


def crear_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verificar_token(
    credenciales: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> dict:
    token = credenciales.credentials
    credenciales_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        usuario_id = payload.get("sub")
        if usuario_id is None:
            raise credenciales_invalidas
        usuario = db.query(models.Usuario).filter(models.Usuario.id == int(usuario_id)).first()
        if not usuario or usuario.estado != "activo":
            raise credenciales_invalidas
        payload["rol_id"] = usuario.rol_id
        return payload
    except (JWTError, TypeError, ValueError):
        raise credenciales_invalidas
    

def hashear_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        raise ValueError("La contraseña no puede superar 72 bytes")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verificar_password(password_plano: str, password_hash: str) -> bool:
    password_bytes = password_plano.encode("utf-8")
    if len(password_bytes) > 72:
        return False
    try:
        return bcrypt.checkpw(password_bytes, password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False



def verificar_rol(*roles_permitidos: int):
    def dependencia(payload: dict = Depends(verificar_token)) -> dict:
        rol_id = payload.get("rol_id")
        if rol_id not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para acceder a este recurso",
            )
        return payload
    return dependencia


