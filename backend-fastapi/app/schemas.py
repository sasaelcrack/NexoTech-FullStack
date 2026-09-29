from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from typing import Literal, Optional
from datetime import datetime


def validar_longitud_bcrypt(password: str) -> str:
    """bcrypt acepta como máximo 72 bytes; se valida antes de hashear o verificar."""
    if len(password.encode("utf-8")) > 72:
        raise ValueError("La contraseña no puede superar 72 bytes")
    return password


def validar_password_segura(password: str) -> str:
    validar_longitud_bcrypt(password)
    if not any(caracter.isupper() for caracter in password) or not any(caracter.isdigit() for caracter in password):
        raise ValueError("La contraseña debe incluir al menos una mayúscula y un número")
    return password


def normalizar_precio_cop(value):
    if isinstance(value, str):
        texto = value.strip().replace(" ", "")
        if texto.replace(".", "").isdigit() and texto.count(".") >= 1:
            return float(texto.replace(".", ""))
        return float(texto.replace(",", "."))
    return value


class UsuarioBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100, pattern=r"^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$")
    apellido: str = Field(..., min_length=2, max_length=100, pattern=r"^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$")
    tipo_documento: str = Field(..., pattern=r"^(CC|CE|TI|PA)$")
    numero_documento: str = Field(..., min_length=6, max_length=15, pattern=r"^\d+$")
    direccion: Optional[str] = Field(None, max_length=200)
    correo: EmailStr
    telefono: Optional[str] = Field(None, pattern=r"^\d{7,10}$")


class UsuarioCreate(UsuarioBase):
    password: str = Field(..., min_length=8, max_length=64)

    @field_validator("password")
    @classmethod
    def validar_password(cls, value):
        return validar_password_segura(value)


class UsuarioLogin(BaseModel):
    correo: EmailStr
    password: str = Field(..., min_length=8, max_length=64)

    @field_validator("password")
    @classmethod
    def validar_password(cls, value):
        return validar_longitud_bcrypt(value)


class RecuperarPasswordRequest(BaseModel):
    correo: EmailStr


class RestablecerPasswordRequest(BaseModel):
    token: str = Field(..., min_length=32, max_length=256)
    password: str = Field(..., min_length=8, max_length=64)

    @field_validator("password")
    @classmethod
    def validar_password(cls, value):
        return validar_password_segura(value)


class UsuarioResponse(BaseModel):
    id: int
    nombre: str
    apellido: str
    tipo_documento: Optional[str] = None
    numero_documento: Optional[str] = None
    direccion: Optional[str] = None
    correo: EmailStr
    telefono: Optional[str] = None
    rol_id: int
    estado: Optional[str] = None
    fecha_creacion: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=100, pattern=r"^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$")
    apellido: Optional[str] = Field(None, min_length=2, max_length=100, pattern=r"^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$")
    tipo_documento: Optional[str] = Field(None, pattern=r"^(CC|CE|TI|PA)$")
    numero_documento: Optional[str] = Field(None, min_length=6, max_length=15, pattern=r"^\d+$")
    direccion: Optional[str] = Field(None, max_length=200)
    correo: Optional[EmailStr] = None
    telefono: Optional[str] = Field(None, pattern=r"^\d{7,10}$")


class CambiarEstado(BaseModel):
    estado: str = Field(..., pattern=r"^(activo|inactivo)$")


class CambiarRol(BaseModel):
    rol_id: int = Field(..., ge=1, le=3)


class ProductoBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    descripcion: Optional[str] = Field(None, max_length=500)
    precio: float = Field(..., gt=0)
    stock: Optional[int] = Field(None, ge=0)
    estado: Optional[str] = "activo"

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, v):
        if v is not None and v not in ("activo", "inactivo"):
            raise ValueError("estado debe ser 'activo' o 'inactivo'")
        return v

    @field_validator("precio", mode="before")
    @classmethod
    def validar_precio_en_pesos(cls, value):
        value = normalizar_precio_cop(value)
        if not float(value).is_integer():
            raise ValueError("El precio debe expresarse en pesos colombianos enteros")
        return value


class ProductoResponse(ProductoBase):
    id: int
    fecha_creacion: Optional[datetime] = None
    imagen_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ServicioBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    descripcion: Optional[str] = Field(None, max_length=500)
    precio: float = Field(..., gt=0)
    estado: Optional[str] = "activo"

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, v):
        if v is not None and v not in ("activo", "inactivo"):
            raise ValueError("estado debe ser 'activo' o 'inactivo'")
        return v

    @field_validator("precio", mode="before")
    @classmethod
    def validar_precio_en_pesos(cls, value):
        value = normalizar_precio_cop(value)
        if not float(value).is_integer():
            raise ValueError("El precio debe expresarse en pesos colombianos enteros")
        return value


class ServicioResponse(ServicioBase):
    id: int
    fecha_creacion: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
        
class ItemCarrito(BaseModel):
    tipo_item: str
    id: int = Field(..., gt=0)
    cantidad: int = Field(1, ge=1)

    @field_validator("tipo_item")
    @classmethod
    def validar_tipo(cls, v):
        if v not in ("producto", "servicio"):
            raise ValueError("tipo_item debe ser 'producto' o 'servicio'")
        return v


class CarritoSync(BaseModel):
    items: list[ItemCarrito] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def validar_items_sin_repetir(self):
        identificadores = [(item.tipo_item, item.id) for item in self.items]
        if len(identificadores) != len(set(identificadores)):
            raise ValueError("Cada producto o servicio debe aparecer una sola vez en el carrito")
        return self


class CarritoItemResponse(BaseModel):
    tipo_item: str
    id: int
    nombre: str
    imagen_url: Optional[str] = None
    cantidad: int
    precio: float
    subtotal: float
    disponible: bool
    stock: Optional[int] = None


class CarritoResponse(BaseModel):
    usuario_id: int
    cliente_nombre: Optional[str] = None
    cliente_correo: Optional[EmailStr] = None
    actualizado_en: Optional[datetime] = None
    items: list[CarritoItemResponse] = Field(default_factory=list)
    subtotal: float = 0
    impuestos: float = 0
    total_estimado: float = 0


class PedidoCreate(BaseModel):
    items: list[ItemCarrito] = Field(..., min_length=1)


class DetallePedidoResponse(BaseModel):
    id: int
    tipo_item: str
    producto_id: Optional[int] = None
    servicio_id: Optional[int] = None
    nombre_item: str
    cantidad: int
    precio_unitario: float

    model_config = ConfigDict(from_attributes=True)


class PedidoResponse(BaseModel):
    id: int
    usuario_id: int
    total: float
    estado: str
    referencia_pago: Optional[str] = None
    fecha_creacion: Optional[datetime] = None
    detalles: list[DetallePedidoResponse] = []

    model_config = ConfigDict(from_attributes=True)


class CambiarEstadoPedido(BaseModel):
    estado: str = Field(..., pattern=r"^(pendiente|pagado|fallido|cancelado)$")


class VentaCreate(BaseModel):
    items: list[ItemCarrito] = Field(..., min_length=1)
    descuento: float = Field(0, ge=0)
    impuestos: float = Field(0, ge=0)

    @model_validator(mode="after")
    def validar_items_sin_repetir(self):
        identificadores = [(item.tipo_item, item.id) for item in self.items]
        if len(identificadores) != len(set(identificadores)):
            raise ValueError("Cada producto o servicio debe aparecer una sola vez en la venta")
        return self


class DetalleVentaResponse(BaseModel):
    id: int
    producto_id: Optional[int] = None
    servicio_id: Optional[int] = None
    cantidad: int
    precio_unitario: float
    subtotal: float

    model_config = ConfigDict(from_attributes=True)


class VentaResponse(BaseModel):
    id: int
    cliente_id: int
    usuario_id: Optional[int] = None
    subtotal: float
    descuento: float
    impuestos: float
    total: float
    estado: str
    fecha: Optional[datetime] = None
    detalles: list[DetalleVentaResponse] = []

    model_config = ConfigDict(from_attributes=True)


class CambiarEstadoVenta(BaseModel):
    estado: str = Field(..., pattern=r"^(pendiente|pagada|cancelada|completada)$")


class DetalleFacturaResponse(BaseModel):
    id: int
    producto_id: Optional[int] = None
    servicio_id: Optional[int] = None
    cantidad: int
    precio_unitario: float
    subtotal: float

    model_config = ConfigDict(from_attributes=True)


class FacturaResponse(BaseModel):
    id: int
    venta_id: int
    numero_factura: str
    cliente_id: int
    subtotal: float
    descuento: float = 0
    impuestos: float
    total: float
    estado: str
    fecha: Optional[datetime] = None
    detalles: list[DetalleFacturaResponse] = []

    model_config = ConfigDict(from_attributes=True)


class PaymentCreate(BaseModel):
    venta_id: int = Field(..., gt=0)


class PaymentResponse(BaseModel):
    id: str
    venta_id: int
    reference: str
    provider: str
    provider_transaction_id: Optional[str] = None
    amount: float
    currency: str
    status: str
    checkout_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PQRCreate(BaseModel):
    asunto: str = Field(..., min_length=5, max_length=150)
    descripcion: str = Field(..., min_length=10, max_length=2000)


class PQRUpdate(BaseModel):
    asunto: str = Field(..., min_length=5, max_length=150)
    descripcion: str = Field(..., min_length=10, max_length=2000)


class PQRRespuesta(BaseModel):
    respuesta: str = Field(..., min_length=2, max_length=2000)
    estado: str = Field("respondida", pattern=r"^(respondida|cerrada)$")


class PQRResponse(BaseModel):
    id: int
    cliente_id: int
    asunto: str
    descripcion: str
    estado: str
    fecha_creacion: Optional[datetime] = None
    fecha_respuesta: Optional[datetime] = None
    respuesta: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ConversacionCreate(BaseModel):
    mensaje: str = Field(..., min_length=1, max_length=2000)


class MensajeCreate(BaseModel):
    mensaje: str = Field(..., min_length=1, max_length=2000)


class MensajeResponse(BaseModel):
    id: int
    remitente: str
    mensaje: str
    fecha: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ConversacionResponse(BaseModel):
    id: int
    usuario_id: int
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    mensajes: list[MensajeResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ChatbotMensaje(BaseModel):
    mensaje: str = Field(..., min_length=1, max_length=1000)


class ChatbotRespuesta(BaseModel):
    respuesta: str
    origen: Literal["gemini", "local"] = "local"
