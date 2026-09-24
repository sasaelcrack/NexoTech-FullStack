# NexoTech - Quinto Avance Técnico

## Arquitectura

NexoTech usa React + Vite en el frontend, FastAPI en el backend y PostgreSQL como persistencia. Alembic controla la evolución del esquema. Stripe procesa pagos en sandbox y Gemini alimenta el chatbot cuando existe una clave configurada; el chatbot local funciona como respaldo.

```text
React/Vite -> API FastAPI -> SQLAlchemy -> PostgreSQL
                    |-> Stripe Webhooks
                    |-> SMTP (recuperación)
                    |-> Gemini (chatbot)
```

## Seguridad

- JWT con validación del usuario activo y rol vigente en cada solicitud.
- Contraseñas con bcrypt y reglas de longitud, mayúscula, número y límite de 72 bytes.
- Tokens de recuperación almacenados como hash, con expiración de 30 minutos y un solo uso.
- CORS restringido mediante `FRONTEND_ORIGINS`.
- Rate limiting para login, recuperación y chatbot.
- Cabeceras `CSP`, `HSTS` en producción, `X-Frame-Options` y `nosniff`.
- Secretos únicamente en `.env`; nunca deben publicarse.

## BackgroundTasks

La solicitud de recuperación guarda el token y agenda el envío SMTP mediante `BackgroundTasks`. La respuesta no revela si el correo existe y el envío no bloquea la petición HTTP.

## FastAPI frente a Django REST Framework

| Aspecto | FastAPI | Django REST Framework |
|---|---|---|
| Rendimiento | ASGI, type hints y soporte async nativo | Muy sólido, normalmente basado en el ecosistema Django |
| Validación | Pydantic v2 integrado | Serializers de DRF |
| Documentación | OpenAPI automática desde tipos y rutas | Requiere configurar esquemas y herramientas adicionales |
| ORM | SQLAlchemy flexible | Django ORM integrado |
| Elección en NexoTech | Menor acoplamiento, validación explícita y API ligera | Habría sido conveniente si se necesitara el panel administrativo completo de Django |

## Pruebas

Las pruebas están en `backend-fastapi/tests/test_api.py` y se ejecutan desde `backend-fastapi`:

```powershell
.\venv\Scripts\python.exe -m pytest -q
```

Cubren salud del API, cabeceras, autenticación sin token, validación `422`, política de contraseñas, rol vigente y usuario inactivo.

## Ejecución local

```powershell
cd backend-fastapi
.\venv\Scripts\python.exe -m alembic upgrade head
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload

cd ..\Frontend
npm.cmd run dev
```

Para Stripe:

```powershell
stripe.exe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to 127.0.0.1:8000/api/v1/webhooks/stripe
```

## Variables de entorno

Copiar `.env.example` a `.env` y completar PostgreSQL, SMTP, JWT, Stripe, CORS y, opcionalmente, Gemini. Las claves reales deben revocarse y regenerarse si alguna vez fueron compartidas.
