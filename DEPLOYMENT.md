# Despliegue de NexoTech

No subas archivos `.env` ni llaves de Stripe al repositorio.

## API y base de datos

Desde `backend-fastapi`, crea el `.env` a partir de `.env.example`. En producción ajusta, como mínimo:

```env
FRONTEND_URL=https://tu-frontend.example.com
FRONTEND_ORIGINS=https://tu-frontend.example.com
STRIPE_SUCCESS_URL=https://tu-frontend.example.com/cliente
STRIPE_CANCEL_URL=https://tu-frontend.example.com/cliente
COMPANY_NAME=NexoTech | Soluciones tecnológicas
COMPANY_NIT=tu_nit_real
COMPANY_EMAIL=contacto@nexotech.com
COMPANY_PHONE=+57 568 458 4215
COMPANY_LOCATION=Medellin, Colombia
```

Los datos `COMPANY_*` aparecen en las facturas PDF y en la fila de identificación del reporte Excel. Configura `COMPANY_NIT` con el NIT legal real antes de emitir facturas; el valor de ejemplo no es un identificador válido.

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

## Imágenes de productos

Las fotos se almacenan en Cloudinary; PostgreSQL guarda únicamente la URL y el identificador del archivo. Configura estas variables en el backend local y en el servicio `nexotech-api` de Render:

```env
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

El secreto solo se usa en FastAPI y no debe añadirse al frontend ni al repositorio. La carga está limitada a imágenes JPG, PNG o WebP de hasta 5 MB y solo el admin puede subirlas o quitarlas. La migración de imagen se ejecuta junto con `alembic upgrade head`; los productos existentes conservan sus datos y muestran la inicial hasta que se les cargue una foto. En desarrollo local, si Cloudinary no está configurado, se usa `backend-fastapi/uploads/` (ignorado por Git); ese almacenamiento local no se activa en producción porque Render no garantiza persistencia del disco del contenedor.

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
7. Añade `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` al servicio `nexotech-api` para habilitar las fotos de productos.

La migración `alembic upgrade head` se ejecuta automáticamente al iniciar el contenedor de la API. No subas `.env`, contraseñas ni llaves privadas al repositorio.
