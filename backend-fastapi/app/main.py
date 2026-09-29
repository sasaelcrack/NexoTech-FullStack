import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request
from starlette.responses import Response
from app import auth
from app.routes import usuarios, productos, servicios, panel, pedidos, ventas, facturas, payments, pqr, conversaciones, dashboards, reportes, chatbot, carritos

en_produccion = os.getenv("ENVIRONMENT", "development").lower() == "production"
@asynccontextmanager
async def ciclo_vida(_app: FastAPI):
    if os.getenv("ENVIRONMENT", "development").lower() == "production":
        if not auth.SECRET_KEY or len(auth.SECRET_KEY) < 32:
            raise RuntimeError("JWT_SECRET debe tener al menos 32 caracteres en producción")
        if auth.ALGORITHM != "HS256":
            raise RuntimeError("JWT_ALGORITHM no permitido")
    yield


app = FastAPI(
    title="NexoTech API",
    docs_url=None if en_produccion else "/docs",
    redoc_url=None if en_produccion else "/redoc",
    lifespan=ciclo_vida,
)

if not en_produccion:
    directorio_imagenes_locales = Path(__file__).resolve().parent.parent / "uploads"
    directorio_imagenes_locales.mkdir(parents=True, exist_ok=True)
    app.mount(
        "/media/productos",
        StaticFiles(directory=directorio_imagenes_locales / "products"),
        name="media-productos-legacy",
    )
    app.mount("/media", StaticFiles(directory=directorio_imagenes_locales), name="media")

allowed_origins = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
)


@app.middleware("http")
async def cabeceras_de_seguridad(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; style-src 'self' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https://res.cloudinary.com"
        + (" http://127.0.0.1:8000 http://localhost:8000" if not en_produccion else "")
        + "; frame-ancestors 'none'; base-uri 'self'"
    )
    if en_produccion:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


app.include_router(usuarios.router)
app.include_router(productos.router)
app.include_router(servicios.router)
app.include_router(panel.router)
app.include_router(pedidos.router)
app.include_router(ventas.router)
app.include_router(facturas.router)
app.include_router(payments.router)
app.include_router(pqr.router)
app.include_router(conversaciones.router)
app.include_router(dashboards.router)
app.include_router(reportes.router)
app.include_router(chatbot.router)
app.include_router(carritos.router)


@app.get("/")
def root():
    return {"mensaje": "API NexoTech funcionando"}


@app.get("/health")
def health():
    """Punto simple para verificar que la API está disponible en despliegue."""
    return {"status": "ok"}
