import os

import stripe

from app.integrations.payment_provider import PaymentProvider


class CheckoutNoCancelableError(Exception):
    pass


class StripeProvider(PaymentProvider):
    """Único punto de contacto entre el servicio de pagos y Stripe."""

    @staticmethod
    def _configurar():
        key = os.getenv("STRIPE_SECRET_KEY")
        if not key:
            raise RuntimeError("Stripe no está configurado")
        stripe.api_key = key

    def crear_checkout(self, **kwargs):
        self._configurar()
        return stripe.checkout.Session.create(**kwargs)

    def obtener_checkout(self, checkout_id: str):
        self._configurar()
        return stripe.checkout.Session.retrieve(checkout_id)

    def expirar_checkout(self, checkout_id: str):
        self._configurar()
        session = stripe.checkout.Session.retrieve(checkout_id)
        if session.status == "expired":
            return session
        if session.status != "open":
            raise CheckoutNoCancelableError("El Checkout ya fue completado")
        return stripe.checkout.Session.expire(checkout_id)

    @staticmethod
    def validar_webhook(payload: bytes, signature: str, secret: str):
        return stripe.Webhook.construct_event(payload, signature, secret)
