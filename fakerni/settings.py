from pathlib import Path
import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# =====================================================
# SECURITY
# =====================================================

SECRET_KEY = os.getenv("SECRET_KEY", "dev-key")
DEBUG = os.getenv("DEBUG", "True") == "True"
ALLOWED_HOSTS = [h.strip() for h in os.getenv("ALLOWED_HOSTS", "").split(",") if h.strip()]
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()
]

# Hardening that only makes sense behind HTTPS — enabled automatically once
# DEBUG=False, since a real deployment is expected to terminate TLS in front
# of (or within) the app. Can be disabled with SECURE_SSL_REDIRECT=False if
# TLS is terminated elsewhere and Django shouldn't redirect itself.
if not DEBUG:
    SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "True") == "True"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 7
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Key for field-level encryption at rest (OTP codes, push tokens).
# Must be a 32-byte url-safe base64 key, e.g. generated with:
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# The default below is for local development only — always set a real
# ENCRYPTION_KEY in production.
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "GxkzjE0nEem2XV_zC-sMB-ZmsFaMTD_uGhHUf6ewyn8=")

AUTH_USER_MODEL = "users.User"

# =====================================================
# APPS
# =====================================================

INSTALLED_APPS = [
    # Channels (must be before django.contrib.staticfiles)
    "daphne",

    # Django core
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "channels",
    "rest_framework",
    "corsheaders",
    "django_filters",
    "rest_framework_simplejwt",
    "drf_spectacular",

    # Local apps
    "users",
    "household",
    "fakras",
]

# =====================================================
# MIDDLEWARE
# =====================================================

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",

    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",

    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# =====================================================
# URLS
# =====================================================

ROOT_URLCONF = "fakerni.urls"
WSGI_APPLICATION = "fakerni.wsgi.application"
ASGI_APPLICATION = "fakerni.asgi.application"

# =====================================================
# CHANNELS
# =====================================================

# InMemoryChannelLayer is single-process only (fine for dev/tests). When
# REDIS_URL is set (e.g. in production via docker-compose), use
# channels_redis so events fan out across multiple ASGI workers.
REDIS_URL = os.getenv("REDIS_URL")

if REDIS_URL:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [REDIS_URL]},
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer"
        }
    }

# =====================================================
# TEMPLATES
# =====================================================

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# =====================================================
# DATABASE
# =====================================================

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "fakerni"),
        "USER": os.getenv("DB_USER", "fakerni_user"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

# =====================================================
# AUTH
# =====================================================

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"
    },
]

# =====================================================
# INTERNATIONALIZATION
# =====================================================

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# =====================================================
# STATIC
# =====================================================

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# =====================================================
# CORS
# =====================================================

CORS_ALLOW_ALL_ORIGINS = True

# =====================================================
# REST FRAMEWORK
# =====================================================

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),

    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),

    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),

    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",

    "PAGE_SIZE": 10,

    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",

    # Rate limiting for sensitive auth endpoints (brute-force protection).
    # Applied via ScopedRateThrottle on RegisterView, EmailTokenObtainPairView,
    # RequestPasswordResetView and ResetPasswordView.
    "DEFAULT_THROTTLE_RATES": {
        "register": "20/minute",
        "login": "20/minute",
        "password_reset": "20/minute",
    },
}

# =====================================================
# API DOCS (drf-spectacular)
# =====================================================

SPECTACULAR_SETTINGS = {
    "TITLE": "Fakerni API",
    "DESCRIPTION": "Family Smart Shopping & Task Coordination App — backend API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# =====================================================
# EMAIL
# =====================================================

# NOTE: prints emails to the console in dev. For production, set
# EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend and configure
# EMAIL_HOST/EMAIL_PORT/EMAIL_HOST_USER/EMAIL_HOST_PASSWORD via env vars.
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"
)

# =====================================================
# PUSH NOTIFICATIONS (Firebase Cloud Messaging)
# =====================================================

# NOTE: push notifications are a no-op until FIREBASE_CREDENTIALS_PATH points
# to a Firebase service-account JSON key file. See users/push.py.
# FIREBASE_CREDENTIALS_PATH is read directly via os.getenv() where needed.

# =====================================================
# SIMPLE JWT
# =====================================================

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# =====================================================
# LOGGING
# =====================================================

# Structured-ish logging to stdout, suitable for container log collectors
# (docker logs, journald, or shipping to a log aggregator). Level is
# configurable via LOG_LEVEL (e.g. DEBUG for local troubleshooting).
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s %(levelname)s %(name)s: %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": LOG_LEVEL,
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}

# =====================================================
# ERROR TRACKING (Sentry)
# =====================================================

# Optional: set SENTRY_DSN to enable error reporting. No-op if unset, so the
# app and its tests run fine without Sentry configured.
SENTRY_DSN = os.getenv("SENTRY_DSN")

if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0")),
        send_default_pii=False,
        environment=os.getenv("SENTRY_ENVIRONMENT", "production" if not DEBUG else "development"),
    )