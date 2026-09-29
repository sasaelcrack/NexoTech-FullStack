import os
from io import BytesIO
from pathlib import Path
import re

import cloudinary
import cloudinary.uploader
from cloudinary.exceptions import Error as CloudinaryError


MAX_IMAGE_BYTES = 5 * 1024 * 1024
LOCAL_IMAGE_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "products"
IMAGE_SIGNATURES = {
    "image/jpeg": ("jpg", lambda content: content.startswith(b"\xff\xd8\xff")),
    "image/png": ("png", lambda content: content.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": ("webp", lambda content: content.startswith(b"RIFF") and content[8:12] == b"WEBP"),
}


class ImageStorageNotConfigured(RuntimeError):
    pass


class ImageStorageError(RuntimeError):
    pass


def validar_imagen(content_type: str | None, content: bytes) -> str:
    if len(content) > MAX_IMAGE_BYTES:
        raise ValueError("La imagen no puede superar los 5 MB")
    image_format = IMAGE_SIGNATURES.get(content_type or "")
    if not image_format or not image_format[1](content):
        raise ValueError("Sube una imagen JPG, PNG o WebP válida")
    return image_format[0]


def _configurar_cloudinary() -> None:
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")
    if not all((cloud_name, api_key, api_secret)):
        raise ImageStorageNotConfigured("El almacenamiento de imágenes no está configurado")
    cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True)


def _usar_almacenamiento_local() -> bool:
    return os.getenv("ENVIRONMENT", "development").lower() != "production" and not all(
        os.getenv(key) for key in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")
    )


def _ruta_imagen_local(public_id: str) -> Path:
    match = re.fullmatch(r"local:productos/(producto-\d+\.(?:jpg|png|webp))", public_id)
    if not match:
        raise ImageStorageError("Identificador local de imagen inválido")
    return LOCAL_IMAGE_ROOT / match.group(1)


def subir_imagen_producto(producto_id: int, content: bytes, image_format: str) -> dict[str, str]:
    if _usar_almacenamiento_local():
        LOCAL_IMAGE_ROOT.mkdir(parents=True, exist_ok=True)
        public_id = f"local:productos/producto-{producto_id}.{image_format}"
        _ruta_imagen_local(public_id).write_bytes(content)
        api_url = os.getenv("LOCAL_API_URL", "http://127.0.0.1:8000").rstrip("/")
        return {
            "url": f"{api_url}/media/products/producto-{producto_id}.{image_format}",
            "public_id": public_id,
        }

    _configurar_cloudinary()
    try:
        result = cloudinary.uploader.upload(
            BytesIO(content),
            folder="nexotech/productos",
            public_id=f"producto-{producto_id}",
            overwrite=True,
            invalidate=True,
            resource_type="image",
            format=image_format,
        )
    except CloudinaryError as error:
        raise ImageStorageError("Cloudinary no pudo guardar la imagen") from error
    secure_url = result.get("secure_url")
    public_id = result.get("public_id")
    if not secure_url or not public_id:
        raise ImageStorageError("Cloudinary devolvió una respuesta incompleta")
    return {"url": secure_url, "public_id": public_id}


def eliminar_imagen_producto(public_id: str) -> None:
    if public_id.startswith("local:"):
        path = _ruta_imagen_local(public_id)
        if path.exists():
            path.unlink()
        return

    _configurar_cloudinary()
    try:
        result = cloudinary.uploader.destroy(public_id, invalidate=True, resource_type="image")
    except CloudinaryError as error:
        raise ImageStorageError("Cloudinary no pudo eliminar la imagen") from error
    if result.get("result") not in {"ok", "not found"}:
        raise ImageStorageError("Cloudinary no confirmó la eliminación de la imagen")