from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db
from app.utils.documentos import datos_empresa, generar_pdf_tabla


router = APIRouter(prefix="/api/facturas", tags=["Facturas"])


def _formato_cop(valor) -> str:
    return f"${int(round(float(valor))):,}".replace(",", ".")


@router.post("/venta/{venta_id}", response_model=schemas.FacturaResponse, status_code=201)
def crear_factura_desde_venta(
    venta_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_rol(1, 2)),
):
    venta = db.query(models.Venta).filter(models.Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    if venta.factura:
        raise HTTPException(status_code=409, detail="La venta ya tiene una factura")
    if venta.estado != "pagada":
        raise HTTPException(status_code=409, detail="Solo se puede facturar una venta pagada")

    factura = models.Factura(
        venta_id=venta.id,
        numero_factura=f"NXT-{venta.id:08d}",
        cliente_id=venta.cliente_id,
        subtotal=venta.subtotal,
        descuento=venta.descuento,
        impuestos=venta.impuestos,
        total=venta.total,
        estado="emitida",
        detalles=[
            models.DetalleFactura(
                producto_id=detalle.producto_id,
                servicio_id=detalle.servicio_id,
                cantidad=detalle.cantidad,
                precio_unitario=detalle.precio_unitario,
                subtotal=detalle.subtotal,
            )
            for detalle in venta.detalles
        ],
    )
    db.add(factura)
    db.commit()
    db.refresh(factura)
    return factura


@router.get("/mias", response_model=list[schemas.FacturaResponse])
def listar_mis_facturas(
    db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_token)
):
    return (
        db.query(models.Factura)
        .filter(models.Factura.cliente_id == int(payload["sub"]))
        .order_by(models.Factura.fecha.desc())
        .all()
    )


@router.get("/", response_model=list[schemas.FacturaResponse])
def listar_facturas(
    db: Session = Depends(get_db), payload: dict = Depends(auth.verificar_rol(1, 2))
):
    return db.query(models.Factura).order_by(models.Factura.fecha.desc()).all()


@router.get("/{factura_id}/pdf")
def descargar_factura_pdf(
    factura_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_token),
):
    factura = db.query(models.Factura).filter(models.Factura.id == factura_id).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if factura.cliente_id != int(payload["sub"]) and payload.get("rol_id") not in (1, 2):
        raise HTTPException(status_code=403, detail="No tienes permiso para ver esta factura")
    cliente = db.query(models.Usuario).filter(models.Usuario.id == factura.cliente_id).first()
    responsable = db.query(models.Usuario).filter(models.Usuario.id == factura.venta.usuario_id).first() if factura.venta.usuario_id else None
    filas = []
    for detalle in factura.detalles:
        if detalle.producto_id:
            tipo = "Producto"
            articulo = db.query(models.Producto).filter(models.Producto.id == detalle.producto_id).first()
        else:
            tipo = "Servicio"
            articulo = db.query(models.Servicio).filter(models.Servicio.id == detalle.servicio_id).first()
        nombre = articulo.nombre if articulo else f"{tipo} no disponible"
        filas.append([f"{nombre} ({tipo})", str(detalle.cantidad), _formato_cop(detalle.precio_unitario), _formato_cop(detalle.subtotal)])
    descuento = factura.descuento or 0
    base_gravable = factura.subtotal - descuento
    filas.extend([
        ["Subtotal", "", "", _formato_cop(factura.subtotal)],
        ["Descuento", "", "", f"- {_formato_cop(descuento)}"],
        ["Base gravable", "", "", _formato_cop(base_gravable)],
        ["IVA (19%)", "", "", _formato_cop(factura.impuestos)],
        ["Total", "", "", _formato_cop(factura.total)],
    ])
    try:
        archivo = generar_pdf_tabla(
            f"Factura {factura.numero_factura} - NexoTech",
            ["Ítem", "Cantidad", "Precio", "Subtotal"],
            filas,
            metadata=[
                *datos_empresa(),
                ("Fecha", factura.fecha.strftime("%Y-%m-%d %H:%M") if factura.fecha else ""),
                ("Venta", f"#{factura.venta_id}"),
                ("Cliente", f"{cliente.nombre} {cliente.apellido}" if cliente else f"Cliente #{factura.cliente_id}"),
                ("Correo", cliente.correo if cliente else ""),
                ("Responsable", f"{responsable.nombre} {responsable.apellido}" if responsable else "Venta en línea"),
                ("Estado", factura.estado.capitalize()),
            ],
            filas_resumen=5,
        )
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail="No fue posible generar la factura") from error
    return StreamingResponse(
        archivo,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={factura.numero_factura}.pdf"},
    )


@router.get("/{factura_id}", response_model=schemas.FacturaResponse)
def obtener_factura(
    factura_id: int,
    db: Session = Depends(get_db),
    payload: dict = Depends(auth.verificar_token),
):
    factura = db.query(models.Factura).filter(models.Factura.id == factura_id).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if factura.cliente_id != int(payload["sub"]) and payload.get("rol_id") not in (1, 2):
        raise HTTPException(status_code=403, detail="No tienes permiso para ver esta factura")
    return factura
