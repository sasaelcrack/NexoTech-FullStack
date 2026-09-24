"""unique_usuario_documento

Revision ID: c8e1d4a9b2f6
Revises: 7381f75d770f
Create Date: 2026-09-20
"""

from typing import Sequence, Union

from alembic import op


revision: str = "c8e1d4a9b2f6"
down_revision: Union[str, Sequence[str], None] = "7381f75d770f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint("uq_usuarios_numero_documento", "usuarios", ["numero_documento"])


def downgrade() -> None:
    op.drop_constraint("uq_usuarios_numero_documento", "usuarios", type_="unique")
