import os
import smtplib

import pytest
from sqlalchemy import text

from app.database import engine


pytestmark = pytest.mark.integration


@pytest.mark.skipif(
    os.getenv("RUN_INTEGRATION") != "1",
    reason="Activa RUN_INTEGRATION=1 para probar servicios locales reales",
)
def test_postgresql_is_reachable_and_migrated():
    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar() == 1
        revision = connection.execute(
            text("SELECT version_num FROM alembic_version")
        ).scalar()
    assert revision == "d3f6a1b8c4e2"


@pytest.mark.skipif(
    os.getenv("RUN_INTEGRATION") != "1",
    reason="Activa RUN_INTEGRATION=1 para probar servicios locales reales",
)
def test_smtp_supports_authenticated_tls():
    host = os.environ["SMTP_HOST"]
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.environ["SMTP_USERNAME"]
    password = os.environ["SMTP_PASSWORD"]

    with smtplib.SMTP(host, port, timeout=10) as server:
        server.starttls()
        server.login(username, password)
