"""support_pqr

Revision ID: d3f6a1b8c4e2
Revises: c8e1d4a9b2f6
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d3f6a1b8c4e2"
down_revision: Union[str, Sequence[str], None] = "c8e1d4a9b2f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table("pqr", sa.Column("id", sa.Integer(), nullable=False), sa.Column("cliente_id", sa.Integer(), nullable=False), sa.Column("asunto", sa.String(150), nullable=False), sa.Column("descripcion", sa.String(2000), nullable=False), sa.Column("estado", sa.String(20), nullable=False), sa.Column("fecha_creacion", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False), sa.Column("fecha_respuesta", sa.TIMESTAMP(), nullable=True), sa.Column("respuesta", sa.String(2000), nullable=True), sa.ForeignKeyConstraint(["cliente_id"], ["usuarios.id"]), sa.PrimaryKeyConstraint("id"))
    op.create_index(op.f("ix_pqr_id"), "pqr", ["id"])
    op.create_index(op.f("ix_pqr_cliente_id"), "pqr", ["cliente_id"])
    op.create_index(op.f("ix_pqr_estado"), "pqr", ["estado"])
    op.create_table("conversaciones", sa.Column("id", sa.Integer(), nullable=False), sa.Column("usuario_id", sa.Integer(), nullable=False), sa.Column("fecha_inicio", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False), sa.Column("fecha_fin", sa.TIMESTAMP(), nullable=True), sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]), sa.PrimaryKeyConstraint("id"))
    op.create_index(op.f("ix_conversaciones_id"), "conversaciones", ["id"])
    op.create_index(op.f("ix_conversaciones_usuario_id"), "conversaciones", ["usuario_id"])
    op.create_table("mensajes", sa.Column("id", sa.Integer(), nullable=False), sa.Column("conversacion_id", sa.Integer(), nullable=False), sa.Column("remitente", sa.String(20), nullable=False), sa.Column("mensaje", sa.String(2000), nullable=False), sa.Column("fecha", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False), sa.ForeignKeyConstraint(["conversacion_id"], ["conversaciones.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"))
    op.create_index(op.f("ix_mensajes_id"), "mensajes", ["id"])
    op.create_index(op.f("ix_mensajes_conversacion_id"), "mensajes", ["conversacion_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_mensajes_conversacion_id"), table_name="mensajes")
    op.drop_index(op.f("ix_mensajes_id"), table_name="mensajes")
    op.drop_table("mensajes")
    op.drop_index(op.f("ix_conversaciones_usuario_id"), table_name="conversaciones")
    op.drop_index(op.f("ix_conversaciones_id"), table_name="conversaciones")
    op.drop_table("conversaciones")
    op.drop_index(op.f("ix_pqr_estado"), table_name="pqr")
    op.drop_index(op.f("ix_pqr_cliente_id"), table_name="pqr")
    op.drop_index(op.f("ix_pqr_id"), table_name="pqr")
    op.drop_table("pqr")
