from abc import ABC, abstractmethod


class PaymentProvider(ABC):
    """Contrato mínimo para una pasarela de pagos."""

    @abstractmethod
    def crear_checkout(self, **kwargs):
        raise NotImplementedError

    @abstractmethod
    def obtener_checkout(self, checkout_id: str):
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    def validar_webhook(payload: bytes, signature: str, secret: str):
        raise NotImplementedError
