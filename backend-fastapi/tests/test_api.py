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
from app.integrations.stripe_provider import CheckoutNoCancelableError, StripeProvider
from app.main import app
from app.services import ia_service
from app.services.payment_service import _linea_checkout
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
    sale = SimpleNamespace(id=12, total=10591)

    line_item = _linea_checkout(sale, "1x Equipo profesional")[0]

    assert line_item["price_data"]["unit_amount"] == 1059100
    assert line_item["quantity"] == 1
    assert line_item["price_data"]["product_data"]["description"] == "1x Equipo profesional"


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
        impuestos=1900,
        total=11900,
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


def test_pdf_report_escapes_user_supplied_markup():
    report = generar_pdf_tabla(
        "Reporte & resumen",
        ["Ítem"],
        [["<b>texto sin cerrar & valor</b>"]],
        metadata=[("Nota", "<texto & dato>")],
    )

    assert report.read(4) == b"%PDF"


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
