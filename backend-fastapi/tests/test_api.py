import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from openpyxl import load_workbook
from starlette.requests import Request

sys.path.insert(0, str(Path(__file__).parents[1]))

from app import auth, models, schemas
from app.database import get_db
from app.integrations import cloudinary_images
from app.integrations.cloudinary_images import ImageStorageNotConfigured, MAX_IMAGE_BYTES, subir_imagen_producto, validar_imagen
from app.integrations.stripe_provider import CheckoutNoCancelableError, StripeProvider
from app.main import app
from app.routes import chatbot as chatbot_route
from app.routes import carritos as carritos_route
from app.routes import productos as productos_route
from app.routes import usuarios as usuarios_route
from app.services import ia_service
from app.services.payment_service import _linea_checkout, aplicar_estado_pago
from app.utils.documentos import generar_excel_ventas, generar_pdf_tabla


@pytest.fixture
def client():
    return TestClient(app)


def test_health_and_security_headers(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"


def test_protected_endpoint_rejects_missing_token(client):
    response = client.get("/api/usuarios/me")

    assert response.status_code == 401


def test_rate_limiter_keeps_a_bounded_number_of_clients(monkeypatch):
    monkeypatch.setattr(auth, "_request_windows", type(auth._request_windows)())
    monkeypatch.setattr(auth, "_MAX_REQUEST_WINDOW_KEYS", 32)

    for index in range(33):
        request = Request({
            "type": "http",
            "method": "POST",
            "path": "/api/chatbot/mensaje",
            "headers": [],
            "query_string": b"",
            "scheme": "http",
            "server": ("testserver", 80),
            "client": (f"test-client-{index}", 1234),
            "root_path": "",
            "http_version": "1.1",
        })
        auth.limitar_solicitudes(request)

    assert len(auth._request_windows) == 32


def test_product_create_requires_authentication(client):
    response = client.post(
        "/api/productos/",
        json={"nombre": "A", "precio": 0, "stock": -1},
    )

    assert response.status_code == 401


def test_product_schema_rejects_invalid_payload():
    with pytest.raises(ValueError):
        schemas.ProductoBase(nombre="A", precio=0, stock=-1)


def test_checkout_amount_uses_sale_total_including_discount_and_tax():
    sale = SimpleNamespace(id=12, subtotal=10000, descuento=1000, impuestos=1710, total=10710)

    line_item = _linea_checkout(sale, "1x Equipo profesional")[0]

    assert line_item["price_data"]["unit_amount"] == 1071000
    assert line_item["quantity"] == 1
    descripcion = line_item["price_data"]["product_data"]["description"]
    assert "Subtotal: $10.000 COP" in descripcion
    assert "Descuento: -$1.000 COP" in descripcion
    assert "IVA (19%): $1.710 COP" in descripcion
    assert "Total: $10.710 COP" in descripcion


def test_create_payment_checks_sale_ownership_before_idempotency_lookup(client, monkeypatch):
    sale = SimpleNamespace(id=99, cliente_id=8)
    queries = []

    class Query:
        def filter(self, *_args):
            return self

        def with_for_update(self):
            return self

        def first(self):
            return sale

    class Database:
        def query(self, model):
            queries.append(model)
            return Query()

    monkeypatch.setitem(app.dependency_overrides, get_db, lambda: Database())
    monkeypatch.setitem(app.dependency_overrides, auth.verificar_token, lambda: {"sub": "7", "rol_id": 3})

    response = client.post(
        "/api/v1/payments",
        headers={"Idempotency-Key": "victim-key"},
        json={"venta_id": 99},
    )

    assert response.status_code == 403
    assert models.Payment not in queries


def test_staff_cannot_mark_sale_paid_without_stripe_approval(client, monkeypatch):
    sale = SimpleNamespace(
        id=42,
        cliente_id=7,
        estado="pendiente",
        detalles=[],
        pagos=[],
    )
    user = SimpleNamespace(id=1, rol_id=1, estado="activo")

    class Query:
        def __init__(self, result):
            self.result = result

        def filter(self, *_args):
            return self

        def with_for_update(self):
            return self

        def first(self):
            return self.result

    class Database:
        def query(self, model):
            return Query(user if model is models.Usuario else sale)

    monkeypatch.setattr(auth, "SECRET_KEY", "test-secret-with-more-than-32-characters")
    monkeypatch.setattr(auth, "ALGORITHM", "HS256")
    monkeypatch.setitem(app.dependency_overrides, get_db, lambda: Database())
    token = auth.crear_token({"sub": "1", "rol_id": 1})

    response = client.patch(
        "/api/ventas/42/estado",
        headers={"Authorization": f"Bearer {token}"},
        json={"estado": "pagada"},
    )

    assert response.status_code == 409
    assert sale.estado == "pendiente"


def test_cannot_delete_last_active_admin(client, monkeypatch):
    actor = SimpleNamespace(id=2, rol_id=1, estado="activo")
    target = SimpleNamespace(id=1, rol_id=1, estado="activo")
    user_queries = []
    deleted = []

    class Query:
        def __init__(self, result=None, count=0):
            self.result = result
            self.count_result = count

        def filter(self, *_args):
            return self

        def with_for_update(self):
            return self

        def first(self):
            return self.result

        def count(self):
            return self.count_result

    class Database:
        def query(self, model):
            if model is models.Rol:
                return Query(SimpleNamespace(id=1))
            if model is models.Usuario:
                user_queries.append(model)
                if len(user_queries) == 1:
                    return Query(actor)
                if len(user_queries) == 2:
                    return Query(target)
                return Query(count=1)
            return Query(count=0)

        def delete(self, instance):
            deleted.append(instance)

    monkeypatch.setattr(auth, "SECRET_KEY", "test-secret-with-more-than-32-characters")
    monkeypatch.setattr(auth, "ALGORITHM", "HS256")
    monkeypatch.setitem(app.dependency_overrides, get_db, lambda: Database())
    token = auth.crear_token({"sub": "2", "rol_id": 1})

    response = client.delete("/api/usuarios/1", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 409
    assert "administrador activo" in response.json()["detail"]
    assert deleted == []


def test_excel_report_stores_formula_like_item_names_as_text():
    sale = SimpleNamespace(
        id=4,
        cliente_id=7,
        usuario_id=None,
        fecha=None,
        estado="pagada",
        subtotal=10000,
        descuento=1000,
        impuestos=1710,
        total=10710,
        detalles=[SimpleNamespace(
            producto_id=3,
            servicio_id=None,
            cantidad=1,
            precio_unitario=10000,
            subtotal=10000,
        )],
    )
    product = SimpleNamespace(nombre='=HYPERLINK("https://example.invalid","click")')
    customer = SimpleNamespace(nombre="Ana", apellido="Lopez", correo="ana@example.com")

    class Query:
        def __init__(self, result):
            self.result = result

        def filter(self, *_args):
            return self

        def first(self):
            return self.result

    class Database:
        def query(self, model):
            return Query(product if model is models.Producto else customer)

    workbook = load_workbook(generar_excel_ventas([sale], Database()), data_only=False)
    cell = workbook["Ventas"]["H5"]

    assert cell.data_type == "s"
    assert cell.value == product.nombre
    assert workbook["Ventas"]["M4"].value == "Descuento (COP)"
    assert workbook["Ventas"]["M5"].value == 1000
    assert workbook["Ventas"]["N5"].value == 9000
    assert workbook["Ventas"]["O5"].value == 1710
    assert workbook["Ventas"]["P5"].value == 10710
    assert workbook["Ventas"].freeze_panes == "A5"


def test_pdf_report_escapes_user_supplied_markup():
    report = generar_pdf_tabla(
        "Reporte & resumen",
        ["Ítem"],
        [["<b>texto sin cerrar & valor</b>"]],
        metadata=[("Nota", "<texto & dato>")],
    )

    assert report.read(4) == b"%PDF"


def test_product_image_validation_checks_real_file_signature_and_size():
    png_header = b"\x89PNG\r\n\x1a\n"

    assert validar_imagen("image/png", png_header) == "png"
    with pytest.raises(ValueError, match="válida"):
        validar_imagen("image/png", b"not an image")
    with pytest.raises(ValueError, match="5 MB"):
        validar_imagen("image/png", png_header + b"x" * MAX_IMAGE_BYTES)


def test_production_does_not_fall_back_to_ephemeral_local_image_storage(monkeypatch, tmp_path):
    monkeypatch.setenv("ENVIRONMENT", "production")
    for key in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setattr(cloudinary_images, "LOCAL_IMAGE_ROOT", tmp_path)

    with pytest.raises(ImageStorageNotConfigured):
        subir_imagen_producto(2, b"\x89PNG\r\n\x1a\n", "png")

    assert list(tmp_path.iterdir()) == []


def test_employee_cannot_upload_product_image(client, monkeypatch):
    product = SimpleNamespace(id=2)

    class Query:
        def filter(self, *_args):
            return self

        def first(self):
            return product

    class Database:
        def query(self, _model):
            return Query()

    monkeypatch.setitem(app.dependency_overrides, get_db, lambda: Database())
    monkeypatch.setitem(app.dependency_overrides, auth.verificar_token, lambda: {"sub": "8", "rol_id": 2})

    response = client.post(
        "/api/productos/2/imagen",
        files={"imagen": ("producto.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )

    assert response.status_code == 403


def test_admin_upload_persists_product_image_url(client, monkeypatch):
    product = SimpleNamespace(
        id=2,
        nombre="Equipo de trabajo",
        descripcion="Equipo configurado",
        precio=1500000,
        stock=3,
        estado="activo",
        fecha_creacion=None,
        imagen_url=None,
        imagen_public_id=None,
    )

    class Query:
        def filter(self, *_args):
            return self

        def first(self):
            return product

    class Database:
        def query(self, _model):
            return Query()

        def commit(self):
            return None

        def refresh(self, _instance):
            return None

    monkeypatch.setitem(app.dependency_overrides, get_db, lambda: Database())
    monkeypatch.setitem(app.dependency_overrides, auth.verificar_token, lambda: {"sub": "1", "rol_id": 1})
    monkeypatch.setattr(
        productos_route,
        "subir_imagen_producto",
        lambda _product_id, _content, _format: {
            "url": "https://res.cloudinary.com/demo/image/upload/producto-2.png",
            "public_id": "nexotech/productos/producto-2",
        },
    )

    response = client.post(
        "/api/productos/2/imagen",
        files={"imagen": ("producto.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )

    assert response.status_code == 200
    assert response.json()["imagen_url"].startswith("https://res.cloudinary.com/")
    assert product.imagen_public_id == "nexotech/productos/producto-2"


def test_admin_removing_product_image_deletes_remote_asset_and_clears_database(client, monkeypatch):
    product = SimpleNamespace(
        id=2,
        nombre="Equipo de trabajo",
        descripcion="Equipo configurado",
        precio=1500000,
        stock=3,
        estado="activo",
        fecha_creacion=None,
        imagen_url="https://res.cloudinary.com/demo/image/upload/producto-2.png",
        imagen_public_id="nexotech/productos/producto-2",
    )
    deleted_ids = []

    class Query:
        def filter(self, *_args):
            return self

        def first(self):
            return product

    class Database:
        def query(self, _model):
            return Query()

        def commit(self):
            return None

        def refresh(self, _instance):
            return None

    monkeypatch.setitem(app.dependency_overrides, get_db, lambda: Database())
    monkeypatch.setitem(app.dependency_overrides, auth.verificar_token, lambda: {"sub": "1", "rol_id": 1})
    monkeypatch.setattr(productos_route, "eliminar_imagen_producto", deleted_ids.append)

    response = client.delete("/api/productos/2/imagen")

    assert response.status_code == 200
    assert response.json()["imagen_url"] is None
    assert deleted_ids == ["nexotech/productos/producto-2"]
    assert product.imagen_public_id is None


def test_local_image_upload_works_without_cloudinary_and_serves_then_removes_file(client, monkeypatch):
    product = SimpleNamespace(
        id=2,
        nombre="Equipo de prueba local",
        descripcion="Producto para validar imagen",
        precio=1500000,
        stock=3,
        estado="activo",
        fecha_creacion=None,
        imagen_url=None,
        imagen_public_id=None,
    )

    class Query:
        def filter(self, *_args):
            return self

        def first(self):
            return product

    class Database:
        def query(self, _model):
            return Query()

        def commit(self):
            return None

        def refresh(self, _instance):
            return None

    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("LOCAL_API_URL", "http://testserver")
    for key in ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"):
        monkeypatch.delenv(key, raising=False)
    image_path = cloudinary_images.LOCAL_IMAGE_ROOT / "producto-2.png"
    if image_path.exists():
        image_path.unlink()
    monkeypatch.setitem(app.dependency_overrides, get_db, lambda: Database())
    monkeypatch.setitem(app.dependency_overrides, auth.verificar_token, lambda: {"sub": "1", "rol_id": 1})

    try:
        uploaded = client.post(
            "/api/productos/2/imagen",
            files={"imagen": ("producto.png", b"\x89PNG\r\n\x1a\n", "image/png")},
        )
        image = client.get("/media/products/producto-2.png")
        previous_image_url = client.get("/media/productos/producto-2.png")
        removed = client.delete("/api/productos/2/imagen")

        assert uploaded.status_code == 200
        assert uploaded.json()["imagen_url"] == "http://testserver/media/products/producto-2.png"
        assert image.status_code == 200
        assert previous_image_url.status_code == 200
        assert image.content == b"\x89PNG\r\n\x1a\n"
        assert removed.status_code == 200
        assert product.imagen_url is None
        assert not image_path.exists()
    finally:
        if image_path.exists():
            image_path.unlink()


@pytest.mark.parametrize("checkout_open", [True, False])
def test_cancel_sale_expires_checkout_before_restoring_stock(client, monkeypatch, checkout_open):
    payment = SimpleNamespace(
        status="PENDING",
        provider="stripe",
        provider_transaction_id="cs_test_123",
    )
    detail = SimpleNamespace(
        id=1,
        producto_id=2,
        servicio_id=None,
        cantidad=1,
        precio_unitario=10000,
        subtotal=10000,
    )
    sale = SimpleNamespace(
        id=42,
        cliente_id=7,
        usuario_id=None,
        subtotal=10000,
        descuento=0,
        impuestos=1900,
        total=11900,
        estado="pendiente",
        fecha=None,
        detalles=[detail],
        pagos=[payment],
    )
    product = SimpleNamespace(stock=0)
    calls = []

    class Query:
        def __init__(self, result):
            self.result = result

        def filter(self, *_args):
            return self

        def with_for_update(self):
            return self

        def first(self):
            return self.result

    class Database:
        def query(self, model):
            return Query(sale if model is models.Venta else product)

        def commit(self):
            calls.append("commit")

        def refresh(self, _instance):
            return None

    def expire_checkout(_provider, checkout_id):
        calls.append(checkout_id)
        if not checkout_open:
            raise CheckoutNoCancelableError()

    monkeypatch.setitem(app.dependency_overrides, get_db, lambda: Database())
    monkeypatch.setitem(app.dependency_overrides, auth.verificar_token, lambda: {"sub": "7", "rol_id": 3})
    monkeypatch.setattr(StripeProvider, "expirar_checkout", expire_checkout)

    response = client.post("/api/ventas/42/cancelar")

    if checkout_open:
        assert response.status_code == 200
        assert sale.estado == "cancelada"
        assert payment.status == "EXPIRED"
        assert product.stock == 1
        assert calls == ["cs_test_123", "commit"]
    else:
        assert response.status_code == 409
        assert sale.estado == "pendiente"
        assert payment.status == "PENDING"
        assert product.stock == 0
        assert calls == ["cs_test_123"]


def test_cancelled_order_restores_stock_only_once(client, monkeypatch):
    detail = SimpleNamespace(
        id=1,
        tipo_item="producto",
        producto_id=2,
        servicio_id=None,
        nombre_item="Equipo de trabajo",
        cantidad=2,
        precio_unitario=10000,
    )
    order = SimpleNamespace(
        id=55,
        usuario_id=7,
        total=20000,
        estado="pendiente",
        referencia_pago="NT-55",
        fecha_creacion=None,
        detalles=[detail],
    )
    product = SimpleNamespace(stock=0)
    user = SimpleNamespace(id=1, rol_id=1, estado="activo")
    commits = []

    class Query:
        def __init__(self, result):
            self.result = result

        def filter(self, *_args):
            return self

        def with_for_update(self):
            return self

        def first(self):
            return self.result

    class Database:
        def query(self, model):
            result = {
                models.Usuario: user,
                models.Pedido: order,
                models.Producto: product,
            }[model]
            return Query(result)

        def commit(self):
            commits.append(True)

        def refresh(self, _instance):
            return None

    monkeypatch.setattr(auth, "SECRET_KEY", "test-secret-with-more-than-32-characters")
    monkeypatch.setattr(auth, "ALGORITHM", "HS256")
    monkeypatch.setitem(app.dependency_overrides, get_db, lambda: Database())
    token = auth.crear_token({"sub": "1", "rol_id": 1})
    headers = {"Authorization": f"Bearer {token}"}

    cancelled = client.patch("/api/pedidos/55/estado", headers=headers, json={"estado": "cancelado"})
    repeated = client.patch("/api/pedidos/55/estado", headers=headers, json={"estado": "cancelado"})
    reopened = client.patch("/api/pedidos/55/estado", headers=headers, json={"estado": "pagado"})

    assert cancelled.status_code == 200
    assert repeated.status_code == 200
    assert reopened.status_code == 409
    assert product.stock == 2
    assert order.estado == "cancelado"
    assert len(commits) == 1


def test_password_policy_applies_to_registration_and_reset():
    common = {
        "nombre": "Ana",
        "apellido": "Lopez",
        "tipo_documento": "CC",
        "numero_documento": "123456",
        "correo": "ana@example.com",
    }

    with pytest.raises(ValueError):
        schemas.UsuarioCreate(**common, password="solamente-minusculas")

    with pytest.raises(ValueError):
        schemas.RestablecerPasswordRequest(token="a" * 32, password="solamente-minusculas")


def test_local_password_recovery_returns_working_single_use_reset_link(client, monkeypatch):
    user = SimpleNamespace(id=14, correo="cliente@example.com", password_hash="old-hash")
    reset_records = []
    commits = []

    class Query:
        def __init__(self, model):
            self.model = model

        def filter(self, *_args):
            return self

        def update(self, values):
            for record in reset_records:
                if record.used_at is None:
                    record.used_at = values["used_at"]
            return len(reset_records)

        def first(self):
            if self.model is models.Usuario:
                return user
            if reset_records and reset_records[-1].used_at is None:
                return reset_records[-1]
            return None

    class Database:
        def query(self, model):
            return Query(model)

        def add(self, record):
            reset_records.append(record)

        def commit(self):
            commits.append(True)

    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("LOCAL_FRONTEND_URL", "http://localhost:5173")
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.setitem(app.dependency_overrides, get_db, lambda: Database())
    monkeypatch.setitem(app.dependency_overrides, auth.limitar_solicitudes, lambda: None)
    monkeypatch.setattr(auth, "hashear_password", lambda password: f"hashed:{password}")
    monkeypatch.setattr(auth, "verificar_password", lambda password, stored_hash: stored_hash == f"hashed:{password}")

    recovery = client.post("/api/usuarios/recuperar", json={"correo": user.correo})
    reset_url = recovery.json()["reset_url"]
    token = reset_url.split("token=", 1)[1]
    response = client.post(
        "/api/usuarios/restablecer",
        json={"token": token, "password": "NuevaClave123"},
    )
    token_reuse = client.post(
        "/api/usuarios/restablecer",
        json={"token": token, "password": "OtraClave123"},
    )

    assert recovery.status_code == 200
    assert reset_url.startswith("http://localhost:5173/restablecer-password?token=")
    assert response.status_code == 200
    assert user.password_hash == "hashed:NuevaClave123"
    assert token_reuse.status_code == 400
    assert len(commits) == 2


def test_chatbot_local_fallback_uses_the_live_product_catalog(client, monkeypatch):
    product = SimpleNamespace(
        id=5,
        nombre="Equipo de trabajo demo",
        descripcion="Configurado para productividad",
        precio=1500000,
        stock=4,
        estado="activo",
    )
    service = SimpleNamespace(
        id=8,
        nombre="Configuración profesional",
        descripcion="Configuración inicial",
        precio=80000,
        estado="activo",
    )

    class Query:
        def __init__(self, result):
            self.result = result

        def filter(self, *_args):
            return self

        def order_by(self, *_args):
            return self

        def limit(self, _limit):
            return self

        def all(self):
            return self.result

    class Database:
        def query(self, model):
            return Query([product] if model is models.Producto else [service])

    monkeypatch.setitem(app.dependency_overrides, get_db, lambda: Database())
    monkeypatch.setitem(app.dependency_overrides, auth.limitar_solicitudes, lambda: None)
    monkeypatch.setattr(chatbot_route, "generar_respuesta_ia", lambda _mensaje, _contexto: None)

    response = client.post("/api/chatbot/mensaje", json={"mensaje": "¿Qué productos y servicios tienen?"})

    assert response.status_code == 200
    assert response.json()["origen"] == "local"
    assert "Equipo de trabajo demo" in response.json()["respuesta"]
    assert "Configuración profesional" in response.json()["respuesta"]
    assert "4 disponibles" in response.json()["respuesta"]


def test_client_saved_cart_uses_database_price_and_tax(client, monkeypatch):
    customer = SimpleNamespace(id=7, nombre="Ana", apellido="Lopez", correo="ana@example.com", estado="activo")
    product = SimpleNamespace(id=3, nombre="Equipo demo", precio=1500000, stock=4, estado="activo", imagen_url="https://images.example/equipo.png")
    database = SimpleNamespace(carrito=None)

    class Query:
        def __init__(self, model):
            self.model = model

        def filter(self, *_args):
            return self

        def with_for_update(self):
            return self

        def first(self):
            if self.model is models.Usuario:
                return customer
            if self.model is models.Producto:
                return product
            return database.carrito

    class Database:
        def query(self, model):
            return Query(model)

        def add(self, item):
            database.carrito = item

        def delete(self, _item):
            database.carrito = None

        def commit(self):
            return None

        def refresh(self, _item):
            return None

    db = Database()
    monkeypatch.setitem(app.dependency_overrides, get_db, lambda: db)
    monkeypatch.setitem(app.dependency_overrides, auth.verificar_token, lambda: {"sub": "7", "rol_id": 3})

    response = client.put(
        "/api/carritos/mio",
        json={"items": [{"tipo_item": "producto", "id": 3, "cantidad": 2, "precio": 1}]},
    )

    assert response.status_code == 200
    assert response.json()["cliente_nombre"] == "Ana Lopez"
    assert response.json()["items"][0]["precio"] == 1500000
    assert response.json()["items"][0]["imagen_url"] == product.imagen_url
    assert response.json()["subtotal"] == 3000000
    assert response.json()["impuestos"] == 570000
    assert response.json()["total_estimado"] == 3570000
    assert database.carrito.items == [{"tipo_item": "producto", "id": 3, "cantidad": 2}]


def test_disabled_product_remains_visible_but_unavailable_in_saved_cart():
    customer = SimpleNamespace(id=7, nombre="Ana", apellido="Lopez", correo="ana@example.com")
    product = SimpleNamespace(id=3, nombre="Equipo demo", precio=1500000, stock=4, estado="inactivo", imagen_url="https://images.example/equipo.png")
    cart = SimpleNamespace(
        actualizado_en=None,
        items=[{"tipo_item": "producto", "id": 3, "cantidad": 2}],
    )

    class Query:
        def __init__(self, model):
            self.model = model

        def filter(self, *_args):
            return self

        def first(self):
            return product if self.model is models.Producto else None

    class Database:
        def query(self, model):
            return Query(model)

    result = carritos_route._materializar_carrito(Database(), cart, customer)

    assert result["items"][0]["nombre"] == "Equipo demo"
    assert result["items"][0]["disponible"] is False
    assert result["items"][0]["imagen_url"] == product.imagen_url
    assert result["subtotal"] == 0
    assert result["impuestos"] == 0


@pytest.mark.parametrize("status", ["EXPIRED", "DECLINED"])
def test_terminal_stripe_payment_cancels_sale_and_restores_stock_once(status):
    product = SimpleNamespace(stock=0)
    detail = SimpleNamespace(producto_id=3, cantidad=2)
    sale = SimpleNamespace(estado="pendiente", detalles=[detail])
    payment = SimpleNamespace(status="PENDING", venta=sale)

    class Query:
        def filter(self, *_args):
            return self

        def with_for_update(self):
            return self

        def first(self):
            return product

    class Database:
        def query(self, _model):
            return Query()

    database = Database()

    assert aplicar_estado_pago(database, payment, status)
    assert payment.status == status
    assert sale.estado == "cancelada"
    assert product.stock == 2
    assert aplicar_estado_pago(database, payment, status) is False
    assert product.stock == 2


def test_disabled_product_cannot_be_purchased(client, monkeypatch):
    class Query:
        def filter(self, *_args):
            return self

        def with_for_update(self):
            return self

        def first(self):
            return None

    class Database:
        def query(self, _model):
            return Query()

    monkeypatch.setitem(app.dependency_overrides, get_db, lambda: Database())
    monkeypatch.setitem(app.dependency_overrides, auth.verificar_token, lambda: {"sub": "7", "rol_id": 3})

    response = client.post("/api/ventas/", json={"items": [{"tipo_item": "producto", "id": 3, "cantidad": 1}]})

    assert response.status_code == 404
    assert "no disponible" in response.json()["detail"]


def test_employee_cannot_overwrite_customer_cart(client, monkeypatch):
    monkeypatch.setitem(app.dependency_overrides, auth.verificar_token, lambda: {"sub": "8", "rol_id": 2})

    response = client.put("/api/carritos/mio", json={"items": []})

    assert response.status_code == 403


def test_token_uses_current_role_and_rejects_inactive_user(monkeypatch):
    monkeypatch.setattr(auth, "SECRET_KEY", "test-secret-with-more-than-32-characters")
    monkeypatch.setattr(auth, "ALGORITHM", "HS256")
    token = auth.crear_token({"sub": "7", "rol_id": 1})

    class User:
        id = 7
        rol_id = 3
        estado = "activo"

    class Query:
        def filter(self, *_args):
            return self

        def first(self):
            return User()

    class Database:
        def query(self, *_args):
            return Query()

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    payload = auth.verificar_token(credentials, Database())
    assert payload["rol_id"] == 3

    User.estado = "inactivo"
    with pytest.raises(HTTPException) as error:
        auth.verificar_token(credentials, Database())
    assert error.value.status_code == 401


def test_gemini_invalid_payload_falls_back_to_local_rules(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"candidates": [None]}

    monkeypatch.setattr(ia_service, "_cuota_disponible", lambda: True)
    monkeypatch.setattr(ia_service.os, "getenv", lambda key, default=None: {
        "GEMINI_API_KEY": "test-key",
        "GEMINI_MODEL": "gemini-2.5-flash-lite",
        "CHATBOT_IA_MAX_TOKENS": "200",
    }.get(key, default))
    monkeypatch.setattr(ia_service.httpx, "post", lambda *args, **kwargs: FakeResponse())

    assert ia_service.generar_respuesta_ia("hola") is None
