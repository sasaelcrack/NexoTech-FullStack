from datetime import datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import auth, models
from app.database import get_db
from app.utils.documentos import generar_excel_ventas, generar_pdf_tabla

router = APIRouter(prefix="/api/reportes", tags=["Reportes"])


def _consultar_ventas(
    db: Session, fecha_desde: datetime | None, fecha_hasta: datetime | None,
    cliente_id: int | None, estado: str | None, producto_id: int | None, servicio_id: int | None,
):
    consulta = db.query(models.Venta).order_by(models.Venta.fecha.desc())
    if fecha_desde:
        consulta = consulta.filter(models.Venta.fecha >= fecha_desde)
    if fecha_hasta:
        fin_dia = datetime.combine(fecha_hasta.date(), time.max) if fecha_hasta.time() == time.min else fecha_hasta
        consulta = consulta.filter(models.Venta.fecha <= fin_dia)
    if cliente_id:
        consulta = consulta.filter(models.Venta.cliente_id == cliente_id)
    if estado:
        consulta = consulta.filter(models.Venta.estado == estado)
    if producto_id or servicio_id:
        consulta = consulta.join(models.DetalleVenta)
    if producto_id:
        consulta = consulta.filter(models.DetalleVenta.producto_id == producto_id)
    if servicio_id:
        consulta = consulta.filter(models.DetalleVenta.servicio_id == servicio_id)
    return consulta.all()


@router.get("/ventas")
def reporte_ventas(
    fecha_desde: datetime | None = Query(None),
    fecha_hasta: datetime | None = Query(None),
    cliente_id: int | None = Query(None, gt=0),
    estado: str | None = Query(None, pattern="^(pendiente|pagada|cancelada|completada)$"),
    producto_id: int | None = Query(None, gt=0),
    servicio_id: int | None = Query(None, gt=0),
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_rol(1, 2)),
):
    ventas = _consultar_ventas(db, fecha_desde, fecha_hasta, cliente_id, estado, producto_id, servicio_id)
    def datos_venta(venta):
        cliente = db.query(models.Usuario).filter(models.Usuario.id == venta.cliente_id).first()
        responsable = db.query(models.Usuario).filter(models.Usuario.id == venta.usuario_id).first() if venta.usuario_id else None
        items = []
        for detalle in venta.detalles:
            articulo = db.query(models.Producto if detalle.producto_id else models.Servicio).filter_by(id=detalle.producto_id or detalle.servicio_id).first()
            items.append(f"{detalle.cantidad}x {articulo.nombre if articulo else 'Ítem no disponible'}")
        return {
            "id": venta.id,
            "cliente_id": venta.cliente_id,
            "cliente_nombre": f"{cliente.nombre} {cliente.apellido}" if cliente else f"Cliente #{venta.cliente_id}",
            "cliente_correo": cliente.correo if cliente else "",
            "responsable": f"{responsable.nombre} {responsable.apellido}" if responsable else "Venta en línea",
            "items": items,
            "fecha": venta.fecha,
            "total": float(venta.total),
            "subtotal": float(venta.subtotal),
            "descuento": float(venta.descuento),
            "base_gravable": float(venta.subtotal - venta.descuento),
            "impuestos": float(venta.impuestos),
            "estado": venta.estado,
        }
    return {
        "total_registros": len(ventas),
        "total_pagado": float(sum(venta.total for venta in ventas if venta.estado == "pagada")),
        "ventas": [
            datos_venta(venta)
            for venta in ventas
        ],
    }


@router.get("/ventas/pdf")
def exportar_ventas_pdf(
    fecha_desde: datetime | None = Query(None), fecha_hasta: datetime | None = Query(None),
    cliente_id: int | None = Query(None, gt=0), estado: str | None = Query(None, pattern="^(pendiente|pagada|cancelada|completada)$"), producto_id: int | None = Query(None, gt=0), servicio_id: int | None = Query(None, gt=0),
    db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2)),
):
    ventas = _consultar_ventas(db, fecha_desde, fecha_hasta, cliente_id, estado, producto_id, servicio_id)
    filas = []
    for venta in ventas:
        cliente = db.query(models.Usuario).filter(models.Usuario.id == venta.cliente_id).first()
        responsable = db.query(models.Usuario).filter(models.Usuario.id == venta.usuario_id).first() if venta.usuario_id else None
        nombres = []
        for detalle in venta.detalles:
            articulo = db.query(models.Producto if detalle.producto_id else models.Servicio).filter_by(id=detalle.producto_id or detalle.servicio_id).first()
            nombres.append(f"{detalle.cantidad}x {articulo.nombre if articulo else 'Ítem no disponible'}")
        filas.append([
            f"#{venta.id}",
            f"{cliente.nombre} {cliente.apellido}" if cliente else f"Cliente #{venta.cliente_id}",
            ", ".join(nombres),
            f"{responsable.nombre} {responsable.apellido}" if responsable else "Venta en línea",
            venta.fecha.strftime("%Y-%m-%d %H:%M") if venta.fecha else "",
            venta.estado,
            f"${float(venta.subtotal):,.0f}".replace(",", "."),
            f"${float(venta.impuestos):,.0f}".replace(",", "."),
            f"${float(venta.total):,.0f}".replace(",", "."),
        ])
    try:
        archivo = generar_pdf_tabla(
            "Reporte detallado de ventas - NexoTech",
            ["Venta", "Cliente", "Ítems", "Responsable", "Fecha", "Estado", "Subtotal", "IVA 19%", "Total"],
            filas,
        )
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="No fue posible generar el reporte PDF") from error
    return StreamingResponse(archivo, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=reporte-ventas.pdf"})


@router.get("/ventas/excel")
def exportar_ventas_excel(
    fecha_desde: datetime | None = Query(None), fecha_hasta: datetime | None = Query(None),
    cliente_id: int | None = Query(None, gt=0), estado: str | None = Query(None, pattern="^(pendiente|pagada|cancelada|completada)$"), producto_id: int | None = Query(None, gt=0), servicio_id: int | None = Query(None, gt=0),
    db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2)),
):
    ventas = _consultar_ventas(db, fecha_desde, fecha_hasta, cliente_id, estado, producto_id, servicio_id)
    try:
        archivo = generar_excel_ventas(ventas, db)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="No fue posible generar el reporte Excel") from error
    return StreamingResponse(
        archivo,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=reporte-ventas.xlsx"},
    )
