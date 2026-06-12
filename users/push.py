import os

import firebase_admin
from firebase_admin import credentials, messaging

from .models import DeviceToken

_firebase_app = None


def _get_firebase_app():
    """Lazily initialize the Firebase app from FIREBASE_CREDENTIALS_PATH.

    Returns None (and push sending becomes a no-op) if the env var is unset,
    so the app and its tests run fine without any Firebase project configured.
    """
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    if not cred_path:
        return None

    _firebase_app = firebase_admin.initialize_app(credentials.Certificate(cred_path))
    return _firebase_app


def send_push_to_users(users, title, body, data=None):
    """Send a push notification to every device token belonging to `users`.

    No-op if Firebase isn't configured. Invalid/unregistered tokens are
    removed from the database.
    """
    app = _get_firebase_app()
    if app is None:
        return

    device_tokens = list(DeviceToken.objects.filter(user__in=users))
    if not device_tokens:
        return

    tokens = [dt.token for dt in device_tokens]

    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=title, body=body),
        data={k: str(v) for k, v in (data or {}).items()},
        tokens=tokens,
    )

    response = messaging.send_each_for_multicast(message, app=app)

    invalid_hashes = [
        dt.token_hash for dt, result in zip(device_tokens, response.responses)
        if not result.success
    ]
    if invalid_hashes:
        DeviceToken.objects.filter(token_hash__in=invalid_hashes).delete()
