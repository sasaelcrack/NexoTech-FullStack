import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

sys.path.insert(0, str(Path(__file__).parents[1]))

from app import auth, schemas
from app.main import app
from app.services import ia_service


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


def test_product_create_requires_authentication(client):
    response = client.post(
        "/api/productos/",
        json={"nombre": "A", "precio": 0, "stock": -1},
    )

    assert response.status_code == 401


def test_product_schema_rejects_invalid_payload():
    with pytest.raises(ValueError):
        schemas.ProductoBase(nombre="A", precio=0, stock=-1)


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
