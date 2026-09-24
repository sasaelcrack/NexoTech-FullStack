# Despliegue de NexoTech

No subas archivos `.env` ni llaves de Stripe al repositorio.

## API y base de datos

Desde `backend-fastapi`, crea el `.env` a partir de `.env.example`. En producción ajusta, como mínimo:

```env
FRONTEND_URL=https://tu-frontend.example.com
FRONTEND_ORIGINS=https://tu-frontend.example.com
STRIPE_SUCCESS_URL=https://tu-frontend.example.com/cliente
STRIPE_CANCEL_URL=https://tu-frontend.example.com/cliente
```

La API expone `GET /health`, útil para el health check del proveedor. Para levantar API y PostgreSQL con Docker:

```powershell
cd backend-fastapi
docker compose up --build
```

## Frontend

El valor público de la API debe llevar `/api` al final:

```env
VITE_API_URL=https://tu-api.example.com/api
```

El frontend usa esa variable durante el build. Ejemplo de contenedor:

```powershell
docker build --build-arg VITE_API_URL=https://tu-api.example.com/api -t nexotech-frontend ./Frontend
```

## Stripe

En el dashboard de Stripe configura un endpoint de webhook público:

```text
https://tu-api.example.com/api/v1/webhooks/stripe
```

Guarda el secreto de firma entregado por Stripe en `STRIPE_WEBHOOK_SECRET`. Usa llaves `sk_live_` y `pk_live_` únicamente cuando el proyecto esté listo para producción.

## Chatbot Gemini

Guarda la clave de Gemini únicamente en el `.env` del backend. El navegador nunca debe recibirla:

```env
GEMINI_API_KEY=tu_clave_de_gemini
GEMINI_MODEL=gemini-2.5-flash-lite
CHATBOT_IA_LIMITE_DIARIO=150
```

Si no configuras la clave, NexoBot conserva sus respuestas locales de respaldo.

## Despliegue en Render

El archivo `render.yaml` crea la base PostgreSQL, la API FastAPI y el frontend React como un Blueprint. En Render:

1. Crea un Blueprint desde este repositorio y selecciona `render.yaml`.
2. Completa las variables marcadas como `sync: false` en el servicio `nexotech-api`.
3. Cuando Render muestre la URL de la API, configura `FRONTEND_URL`, `FRONTEND_ORIGINS`, `STRIPE_SUCCESS_URL` y `STRIPE_CANCEL_URL`.
4. En `nexotech-frontend`, configura `VITE_API_URL` con la URL de la API terminada en `/api`.
5. Despliega de nuevo el frontend después de guardar esa variable, porque se incorpora durante el build.
6. Configura en Stripe el webhook `https://<api>/api/v1/webhooks/stripe` y guarda su secreto en `STRIPE_WEBHOOK_SECRET`.

La migración `alembic upgrade head` se ejecuta automáticamente al iniciar el contenedor de la API. No subas `.env`, contraseñas ni llaves privadas al repositorio.
