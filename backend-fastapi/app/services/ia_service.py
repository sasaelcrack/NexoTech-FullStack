import os
import logging
import threading
from datetime import date

import httpx

GEMINI_API_URL_TMPL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
)
logger = logging.getLogger(__name__)

# Prompt de sistema: obliga al modelo a hablar solo de temas de NexoTech.
SYSTEM_INSTRUCTION = (
    "Eres el asistente virtual de NexoTech, una empresa de soluciones tecnológicas. "
    "SOLO puedes responder preguntas relacionadas con NexoTech: sus productos, servicios, "
    "ventas, pagos, facturas, PQR (peticiones, quejas y reclamos) y el uso de la plataforma. "
    "Si preguntan cómo volver al panel después de regresar al inicio, explica que deben hacer clic "
    "en el logo o abrir el menú de cuenta y elegir 'Ir al panel'; si cerraron sesión, deben iniciar sesión otra vez. "
    "Responde siempre en español, de forma breve (máximo 3 frases) y clara. "
    "Si el usuario pregunta algo que NO tiene relación con NexoTech (temas generales, "
    "otras empresas, opiniones personales, tareas ajenas, etc.), responde amablemente que "
    "solo puedes ayudar con temas de NexoTech y sugiere que reformule la pregunta."
)

# --- Control simple de cuota diaria para no agotar la capa gratuita de Gemini ---
# Nota: es un contador en memoria (se reinicia si el servidor se reinicia).
# Ajusta LIMITE_DIARIO según la cuota gratuita vigente en ai.google.dev/gemini-api/docs/rate-limits
LIMITE_DIARIO = int(os.getenv("CHATBOT_IA_LIMITE_DIARIO", "150"))
_lock = threading.Lock()
_contador = {"fecha": None, "usos": 0}


def _cuota_disponible() -> bool:
    with _lock:
        hoy = date.today()
        if _contador["fecha"] != hoy:
            _contador["fecha"] = hoy
            _contador["usos"] = 0
        if _contador["usos"] >= LIMITE_DIARIO:
            return False
        _contador["usos"] += 1
        return True


def _extraer_texto_gemini(data: dict) -> str | None:
    """Extrae texto de Gemini sin romper si el payload llega incompleto."""
    candidates = data.get("candidates") or []
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        content = candidate.get("content") or {}
        parts = content.get("parts") or []
        for part in parts:
            if isinstance(part, dict):
                texto = part.get("text")
                if isinstance(texto, str) and texto.strip():
                    return texto.strip()
    return None


def generar_respuesta_ia(mensaje: str) -> str | None:
    """
    Intenta responder usando Gemini. Devuelve None si la IA no está configurada,
    si se agotó la cuota diaria propia, o si falla la llamada — en cualquiera de
    esos casos, el router debe caer al chatbot de reglas fijas.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("Gemini is not configured: GEMINI_API_KEY is missing")
        return None
    if not _cuota_disponible():
        logger.warning("Gemini fallback used: daily request limit reached")
        return None

    modelo = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
    url = GEMINI_API_URL_TMPL.format(modelo=modelo)

    body = {
        "system_instruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
        "contents": [{"role": "user", "parts": [{"text": mensaje}]}],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": int(os.getenv("CHATBOT_IA_MAX_TOKENS", "200")),
        },
    }

    try:
        respuesta = httpx.post(
            url,
            params={"key": api_key},
            json=body,
            timeout=10,
        )
        respuesta.raise_for_status()
        data = respuesta.json()
        texto = _extraer_texto_gemini(data)
        if not texto:
            logger.warning("Gemini returned no candidate text")
            return None
        logger.info("Gemini response received successfully")
        return texto
    except httpx.HTTPStatusError as error:
        logger.warning("Gemini API returned HTTP status %s", error.response.status_code)
        return None
    except (httpx.HTTPError, TypeError, ValueError) as error:
        logger.warning("Gemini request failed (%s)", type(error).__name__)
        return None