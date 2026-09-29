"""Persist active carts and invoice discounts."""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6a8d3c1b902"
down_revision: Union[str, Sequence[str], None] = "e4f7c2a9d301"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "carritos_activos",
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("actualizado_en", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("usuario_id"),
    )
    op.create_index("ix_carritos_activos_actualizado_en", "carritos_activos", ["actualizado_en"], unique=False)
    op.add_column("facturas", sa.Column("descuento", sa.Numeric(precision=12, scale=2), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("facturas", "descuento")
    op.drop_index("ix_carritos_activos_actualizado_en", table_name="carritos_activos")
    op.drop_table("carritos_activos")