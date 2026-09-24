from sqlalchemy import func
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import auth, models
from app.database import get_db

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def _ventas_y_catalogo(db: Session) -> dict:
    """Bloques comunes a admin y empleado: no incluyen datos de usuarios (eso es solo de admin)."""
    total_ventas = db.query(func.count(models.Venta.id)).scalar() or 0
    ventas_pagadas = db.query(func.count(models.Venta.id)).filter(models.Venta.estado == "pagada").scalar() or 0
    ingresos = db.query(func.coalesce(func.sum(models.Venta.total), 0)).filter(models.Venta.estado == "pagada").scalar()
    return {
        "ventas": {"total": total_ventas, "pagadas": ventas_pagadas, "ingresos": float(ingresos)},
        "catalogo": {
            "productos_activos": db.query(func.count(models.Producto.id)).filter(models.Producto.estado == "activo").scalar() or 0,
            "servicios_activos": db.query(func.count(models.Servicio.id)).filter(models.Servicio.estado == "activo").scalar() or 0,
            "stock_bajo": db.query(func.count(models.Producto.id)).filter(models.Producto.stock.is_not(None), models.Producto.stock <= 5).scalar() or 0,
        },
        "atencion": {
            "total": db.query(func.count(models.PQR.id)).scalar() or 0,
            "abiertas": db.query(func.count(models.PQR.id)).filter(models.PQR.estado == "abierta").scalar() or 0,
            "respondidas": db.query(func.count(models.PQR.id)).filter(models.PQR.estado == "respondida").scalar() or 0,
            "cerradas": db.query(func.count(models.PQR.id)).filter(models.PQR.estado == "cerrada").scalar() or 0,
        },
    }


@router.get("/admin")
def dashboard_admin(db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1))):
    """Vista completa: incluye gestión de usuarios además de ventas, catálogo y atención."""
    datos = _ventas_y_catalogo(db)
    datos["usuarios"] = {
        "total": db.query(func.count(models.Usuario.id)).scalar() or 0,
        "activos": db.query(func.count(models.Usuario.id)).filter(models.Usuario.estado == "activo").scalar() or 0,
        "administradores": db.query(func.count(models.Usuario.id)).filter(models.Usuario.rol_id == 1, models.Usuario.estado == "activo").scalar() or 0,
        "empleados": db.query(func.count(models.Usuario.id)).filter(models.Usuario.rol_id == 2, models.Usuario.estado == "activo").scalar() or 0,
        "clientes": db.query(func.count(models.Usuario.id)).filter(models.Usuario.rol_id == 3, models.Usuario.estado == "activo").scalar() or 0,
    }
    return datos


@router.get("/empleado")
def dashboard_empleado(db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2))):
    """El empleado no gestiona usuarios, así que ese bloque no se expone aquí."""
    return _ventas_y_catalogo(db)


@router.get("/cliente")
def dashboard_cliente(db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(3))):
    """Resumen acotado a los datos propios del cliente autenticado (nunca de otros clientes)."""
    cliente_id = int(payload["sub"])
    ventas_cliente = db.query(models.Venta).filter(models.Venta.cliente_id == cliente_id)
    return {
        "compras": {
            "total": ventas_cliente.count(),
            "pagadas": ventas_cliente.filter(models.Venta.estado == "pagada").count(),
        },
        "facturas": {
            "total": db.query(func.count(models.Factura.id)).filter(models.Factura.cliente_id == cliente_id).scalar() or 0,
        },
        "pagos": {
            "aprobados": db.query(func.count(models.Payment.id))
            .join(models.Venta)
            .filter(models.Venta.cliente_id == cliente_id, models.Payment.status == "APPROVED")
            .scalar() or 0,
        },
        "pqr": {
            "abiertas": db.query(func.count(models.PQR.id))
            .filter(models.PQR.cliente_id == cliente_id, models.PQR.estado == "abierta")
            .scalar() or 0,
        },
    }
