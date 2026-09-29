import os
from io import BytesIO

import cloudinary
import cloudinary.uploader
from cloudinary.exceptions import Error as CloudinaryError


MAX_IMAGE_BYTES = 5 * 1024 * 1024
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


def subir_imagen_producto(producto_id: int, content: bytes, image_format: str) -> dict[str, str]:
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
    _configurar_cloudinary()
    try:
        result = cloudinary.uploader.destroy(public_id, invalidate=True, resource_type="image")
    except CloudinaryError as error:
        raise ImageStorageError("Cloudinary no pudo eliminar la imagen") from error
    if result.get("result") not in {"ok", "not found"}:
        raise ImageStorageError("Cloudinary no confirmó la eliminación de la imagen")