import uuid

from sqlalchemy import Column, Integer, String, TIMESTAMP, Numeric, ForeignKey, DateTime, JSON, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Rol(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True)
    nombre = Column(String(50), nullable=False, unique=True)


class Permiso(Base):
    __tablename__ = "permisos"

    id = Column(Integer, primary_key=True)
    rol_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    modulo = Column(String(50), nullable=False)
    puede_gestionar = Column(Integer, nullable=False, default=0)

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    tipo_documento = Column(String(20), nullable=False)
    numero_documento = Column(String(30), nullable=False, unique=True)
    direccion = Column(String(200), nullable=True)
    correo = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    telefono = Column(String(20), nullable=True)
    rol_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    estado = Column(String(20), nullable=True)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    

class Producto(Base):
    __tablename__ = "productos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(String(500), nullable=True)
    precio = Column(Numeric(10, 2), nullable=False)
    stock = Column(Integer, nullable=True)
    estado = Column(String(20), nullable=True)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())


class Servicio(Base):
    __tablename__ = "servicios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(String(500), nullable=True)
    precio = Column(Numeric(10, 2), nullable=False)
    estado = Column(String(20), nullable=True)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())
    
class Pedido(Base):
    __tablename__ = "pedidos"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    total = Column(Numeric(10, 2), nullable=False)
    estado = Column(String(20), nullable=False, default="pendiente")  # pendiente|pagado|fallido|cancelado
    referencia_pago = Column(String(100), unique=True, nullable=True)
    fecha_creacion = Column(TIMESTAMP, server_default=func.now())

    detalles = relationship("DetallePedido", back_populates="pedido", cascade="all, delete-orphan")


class DetallePedido(Base):
    __tablename__ = "detalle_pedidos"

    id = Column(Integer, primary_key=True, index=True)
    pedido_id = Column(Integer, ForeignKey("pedidos.id"), nullable=False)
    tipo_item = Column(String(20), nullable=False)  # "producto" | "servicio"
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=True)
    servicio_id = Column(Integer, ForeignKey("servicios.id"), nullable=True)
    nombre_item = Column(String(100), nullable=False)   # snapshot del nombre al comprar
    cantidad = Column(Integer, nullable=False, default=1)
    precio_unitario = Column(Numeric(10, 2), nullable=False)

    pedido = relationship("Pedido", back_populates="detalles")


class Venta(Base):
    __tablename__ = "ventas"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True, index=True)
    fecha = Column(TIMESTAMP, nullable=False, server_default=func.now())
    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    descuento = Column(Numeric(12, 2), nullable=False, default=0)
    impuestos = Column(Numeric(12, 2), nullable=False, default=0)
    total = Column(Numeric(12, 2), nullable=False)
    estado = Column(String(20), nullable=False, default="pendiente")

    detalles = relationship("DetalleVenta", back_populates="venta", cascade="all, delete-orphan")
    factura = relationship("Factura", back_populates="venta", uselist=False)
    pagos = relationship("Payment", back_populates="venta")


class DetalleVenta(Base):
    __tablename__ = "detalle_ventas"
    __table_args__ = (
        CheckConstraint(
            "(producto_id IS NOT NULL AND servicio_id IS NULL) OR "
            "(producto_id IS NULL AND servicio_id IS NOT NULL)",
            name="ck_detalle_venta_item",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    venta_id = Column(Integer, ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=True)
    servicio_id = Column(Integer, ForeignKey("servicios.id"), nullable=True)
    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)

    venta = relationship("Venta", back_populates="detalles")


class Factura(Base):
    __tablename__ = "facturas"

    id = Column(Integer, primary_key=True, index=True)
    venta_id = Column(Integer, ForeignKey("ventas.id"), nullable=False, unique=True)
    numero_factura = Column(String(50), nullable=False, unique=True)
    fecha = Column(TIMESTAMP, nullable=False, server_default=func.now())
    cliente_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    subtotal = Column(Numeric(12, 2), nullable=False)
    impuestos = Column(Numeric(12, 2), nullable=False, default=0)
    total = Column(Numeric(12, 2), nullable=False)
    estado = Column(String(20), nullable=False, default="emitida")

    venta = relationship("Venta", back_populates="factura")
    detalles = relationship("DetalleFactura", back_populates="factura", cascade="all, delete-orphan")


class DetalleFactura(Base):
    __tablename__ = "detalle_facturas"
    __table_args__ = (
        CheckConstraint(
            "(producto_id IS NOT NULL AND servicio_id IS NULL) OR "
            "(producto_id IS NULL AND servicio_id IS NOT NULL)",
            name="ck_detalle_factura_item",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    factura_id = Column(Integer, ForeignKey("facturas.id", ondelete="CASCADE"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=True)
    servicio_id = Column(Integer, ForeignKey("servicios.id"), nullable=True)
    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)

    factura = relationship("Factura", back_populates="detalles")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    venta_id = Column(Integer, ForeignKey("ventas.id"), nullable=False, index=True)
    reference = Column(String(100), nullable=False, unique=True, index=True)
    idempotency_key = Column(String(255), nullable=True, unique=True)
    provider = Column(String(30), nullable=False)
    provider_transaction_id = Column(String(100), nullable=True, unique=True, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="COP")
    status = Column(String(20), nullable=False, default="PENDING", index=True)
    payment_method = Column(String(50), nullable=True)
    customer_email = Column(String(100), nullable=False)
    customer_name = Column(String(200), nullable=True)
    redirect_url = Column(String(500), nullable=True)
    checkout_url = Column(String(500), nullable=True)
    raw_response = Column(JSON, nullable=True)
    webhook_payload = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now(), index=True)
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now(), onupdate=func.now())

    venta = relationship("Venta", back_populates="pagos")


class PQR(Base):
    __tablename__ = "pqr"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    asunto = Column(String(150), nullable=False)
    descripcion = Column(String(2000), nullable=False)
    estado = Column(String(20), nullable=False, default="abierta", index=True)
    fecha_creacion = Column(TIMESTAMP, nullable=False, server_default=func.now())
    fecha_respuesta = Column(TIMESTAMP, nullable=True)
    respuesta = Column(String(2000), nullable=True)


class Conversacion(Base):
    __tablename__ = "conversaciones"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False, index=True)
    fecha_inicio = Column(TIMESTAMP, nullable=False, server_default=func.now())
    fecha_fin = Column(TIMESTAMP, nullable=True)
    mensajes = relationship("Mensaje", back_populates="conversacion", cascade="all, delete-orphan")


class Mensaje(Base):
    __tablename__ = "mensajes"

    id = Column(Integer, primary_key=True, index=True)
    conversacion_id = Column(Integer, ForeignKey("conversaciones.id", ondelete="CASCADE"), nullable=False, index=True)
    remitente = Column(String(20), nullable=False)
    mensaje = Column(String(2000), nullable=False)
    fecha = Column(TIMESTAMP, nullable=False, server_default=func.now())
    conversacion = relationship("Conversacion", back_populates="mensajes")
