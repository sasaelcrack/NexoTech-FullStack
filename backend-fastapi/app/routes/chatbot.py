import unicodedata
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app import auth, models, schemas
from app.database import get_db
from app.services.ia_service import generar_respuesta_ia


router = APIRouter(prefix="/api/chatbot", tags=["Chatbot"])
logger = logging.getLogger(__name__)


def _formato_precio(valor) -> str:
    return f"${int(valor):,}".replace(",", ".")


def _cargar_catalogo(db: Session) -> tuple[list[models.Producto], list[models.Servicio]]:
    productos = (
        db.query(models.Producto)
        .filter(models.Producto.estado == "activo")
        .order_by(models.Producto.id.asc())
        .limit(20)
        .all()
    )
    servicios = (
        db.query(models.Servicio)
        .filter(models.Servicio.estado == "activo")
        .order_by(models.Servicio.id.asc())
        .limit(20)
        .all()
    )
    return productos, servicios


def _contexto_catalogo(productos: list[models.Producto], servicios: list[models.Servicio]) -> str:
    lineas = []
    for etiqueta, items in (("Productos", productos), ("Servicios", servicios)):
        lineas.append(f"{etiqueta} activos:")
        if not items:
            lineas.append("- Ninguno disponible actualmente")
            continue
        for item in items:
            detalle = f": {item.descripcion.strip()[:160]}" if item.descripcion else ""
            precio = _formato_precio(item.precio)
            stock = f"; existencias: {item.stock}" if etiqueta == "Productos" and item.stock is not None else ""
            lineas.append(f"- {item.nombre[:100]}{detalle}; precio: {precio} COP{stock}")
    return "\n".join(lineas)


def _respuesta_por_reglas(
    mensaje: str,
    productos: list[models.Producto] | None = None,
    servicios: list[models.Servicio] | None = None,
) -> str:
    """Asistente base local, sin costo ni llaves externas. Sirve de respaldo si la IA no responde."""
    mensaje = "".join(
        caracter for caracter in unicodedata.normalize("NFD", mensaje)
        if unicodedata.category(caracter) != "Mn"
    )
    productos = productos or []
    servicios = servicios or []

    consulta_productos = any(palabra in mensaje for palabra in ("producto", "productos"))
    consulta_servicios = any(palabra in mensaje for palabra in ("servicio", "servicios"))
    consulta_catalogo = any(palabra in mensaje for palabra in ("catalogo", "ofrecen", "disponible", "disponibles"))
    if consulta_productos or consulta_servicios or consulta_catalogo:
        incluir_productos = consulta_productos or consulta_catalogo
        incluir_servicios = consulta_servicios or consulta_catalogo
        respuestas_catalogo = []
        if incluir_productos:
            lista = "; ".join(
                f"{item.nombre} ({_formato_precio(item.precio)} COP"
                f"{f', {item.stock} disponibles' if item.stock is not None else ''})"
                for item in productos[:10]
            )
            respuestas_catalogo.append(f"Productos: {lista or 'no hay productos activos ahora'}.")
        if incluir_servicios:
            lista = "; ".join(
                f"{item.nombre} ({_formato_precio(item.precio)} COP)"
                for item in servicios[:10]
            )
            respuestas_catalogo.append(f"Servicios: {lista or 'no hay servicios activos ahora'}.")
        respuestas_catalogo.append("Los datos se consultaron del catálogo actual.")
        return " ".join(respuestas_catalogo)

    respuestas = [
        (("como accedo", "como entro", "como abro", "ayudame a abrir", "abrir el panel", "accedo al panel", "entrar al panel", "volver al panel", "regresar al panel", "desde el inicio", "volvi al inicio", "ir al panel", "logo"), "Si ya tienes la sesión iniciada y volviste al inicio, haz clic en el logo o abre el menú de cuenta en la parte superior derecha y selecciona Ir al panel. Si cerraste sesión, entra primero por Iniciar sesión."),
        (("servicio", "servicios"), "NexoTech ofrece servicios tecnológicos como inducción a redes, liderazgo y asesoría. Inicia sesión como cliente, abre Servicios y agrega la solución que necesites al carrito."),
        (("pago", "stripe", "tarjeta"), "Puedes pagar con Stripe al confirmar tu compra. Si sales de Stripe, la venta queda registrada como pendiente en Mis pedidos hasta completar el flujo de pago."),
        (("factura",), "Cuando Stripe confirme un pago, generamos la factura automáticamente. La encuentras en Mis pedidos y puedes descargarla en PDF."),
        (("pqr", "queja", "reclamo", "petición", "peticion"), "Desde el panel de cliente, abre Soporte para crear una PQR y consultar la respuesta del equipo."),
        (("producto", "compra"), "Puedes explorar productos y servicios desde el panel de cliente, agregarlos al carrito y confirmar la compra."),
        (("hola", "buenas", "ayuda"), "Hola, soy el asistente de NexoTech. Puedo orientarte sobre compras, pagos, facturas y soporte."),
    ]
    return next((texto for palabras, texto in respuestas if any(palabra in mensaje for palabra in palabras)), "Puedo ayudarte con compras, pagos, facturas y PQR. Si necesitas atención personalizada, abre una conversación en Soporte.")


@router.post("/mensaje", response_model=schemas.ChatbotRespuesta)
def responder_mensaje(
    datos: schemas.ChatbotMensaje,
    db: Session = Depends(get_db),
    _limite: None = Depends(auth.limitar_solicitudes),
):
    """
    Intenta responder con IA (Gemini, acotada a temas de NexoTech y con cuota diaria propia).
    Si la IA no está configurada, se agotó la cuota, o falla la llamada, cae al chatbot de reglas.
    """
    try:
        productos, servicios = _cargar_catalogo(db)
    except SQLAlchemyError:
        db.rollback()
        logger.warning("Could not load catalog context for chatbot")
        productos, servicios = [], []

    respuesta_ia = generar_respuesta_ia(datos.mensaje, _contexto_catalogo(productos, servicios))
    if respuesta_ia:
        return {"respuesta": respuesta_ia, "origen": "gemini"}
    return {
        "respuesta": _respuesta_por_reglas(datos.mensaje.lower().strip(), productos, servicios),
        "origen": "local",
    }