from fastapi import APIRouter, Depends
from app import auth

router = APIRouter(prefix="/api/panel", tags=["Paneles"])


@router.get("/admin")
def panel_admin(payload: dict = Depends(auth.verificar_rol(1))):
    return {
        "mensaje": "Bienvenido al panel de administrador",
        "rol": "admin",
        "permisos": [
            "gestionar_usuarios",
            "gestionar_productos",
            "gestionar_servicios",
            "ver_reportes"
        ]
    }


@router.get("/empleado")
def panel_empleado(payload: dict = Depends(auth.verificar_rol(1, 2))):
    return {
        "mensaje": "Bienvenido al panel de empleado",
        "rol": "empleado",
        "permisos": [
            "gestionar_productos",
            "gestionar_servicios"
        ]
    }


@router.get("/cliente")
def panel_cliente(payload: dict = Depends(auth.verificar_rol(1, 2, 3))):
    return {
        "mensaje": "Bienvenido al panel de cliente",
        "rol": "cliente",
        "permisos": [
            "ver_productos",
            "ver_servicios",
            "comprar"
        ]
    }