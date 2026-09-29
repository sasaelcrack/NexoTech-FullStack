"""Add optional Cloudinary image metadata to products."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4f7c2a9d301"
down_revision: Union[str, Sequence[str], None] = "d3f6a1b8c4e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("productos", sa.Column("imagen_url", sa.String(length=1000), nullable=True))
    op.add_column("productos", sa.Column("imagen_public_id", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("productos", "imagen_public_id")
    op.drop_column("productos", "imagen_url")