from app import models


def obtener_por_idempotencia(db, idempotency_key: str):
    return db.query(models.Payment).filter(models.Payment.idempotency_key == idempotency_key).first()


def obtener_pendiente_de_venta(db, venta_id: int):
    return (
        db.query(models.Payment)
        .filter(models.Payment.venta_id == venta_id, models.Payment.status == "PENDING")
        .first()
    )


def obtener_por_id(db, payment_id):
    return db.query(models.Payment).filter(models.Payment.id == payment_id).first()


def obtener_por_referencia(db, reference: str):
    return db.query(models.Payment).filter(models.Payment.reference == reference).first()
