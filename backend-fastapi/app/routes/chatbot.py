import unicodedata

from fastapi import APIRouter, Depends

from app import auth, schemas
from app.services.ia_service import generar_respuesta_ia


router = APIRouter(prefix="/api/chatbot", tags=["Chatbot"])


def _respuesta_por_reglas(mensaje: str) -> str:
    """Asistente base local, sin costo ni llaves externas. Sirve de respaldo si la IA no responde."""
    mensaje = "".join(
        caracter for caracter in unicodedata.normalize("NFD", mensaje)
        if unicodedata.category(caracter) != "Mn"
    )
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
    _limite: None = Depends(auth.limitar_solicitudes),
):
    """
    Intenta responder con IA (Gemini, acotada a temas de NexoTech y con cuota diaria propia).
    Si la IA no está configurada, se agotó la cuota, o falla la llamada, cae al chatbot de reglas.
    """
    respuesta_ia = generar_respuesta_ia(datos.mensaje)
    if respuesta_ia:
        return {"respuesta": respuesta_ia}
    return {"respuesta": _respuesta_por_reglas(datos.mensaje.lower().strip())}