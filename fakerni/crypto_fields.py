from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models

_fernet = None


def _get_fernet():
    global _fernet
    if _fernet is None:
        _fernet = Fernet(settings.ENCRYPTION_KEY)
    return _fernet


class EncryptedCharField(models.CharField):
    """A CharField that is transparently encrypted at rest using Fernet.

    `max_length` describes the plaintext length; the column itself is sized
    generously to hold the (longer) ciphertext.
    """

    def __init__(self, *args, **kwargs):
        self.plain_max_length = kwargs.get("max_length")
        super().__init__(*args, **kwargs)

    def db_type(self, connection):
        return "varchar(512)"

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value is None or value == "":
            return value
        return _get_fernet().encrypt(value.encode()).decode()

    def from_db_value(self, value, expression, connection):
        if value is None or value == "":
            return value
        try:
            return _get_fernet().decrypt(value.encode()).decode()
        except InvalidToken:
            # Pre-existing plaintext data from before encryption was enabled.
            return value
