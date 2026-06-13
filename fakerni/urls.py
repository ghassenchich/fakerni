from django.conf import settings
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import RedirectView
from django.views.static import serve
from .views import healthz
from users.views import (
    RegisterView,
    EmailTokenObtainPairView,
    RequestPasswordResetView,
    ResetPasswordView,
    ProfileView,
    ChangePasswordView,
    DeviceTokenView,
    DeviceTokenDetailView,
)
from rest_framework_simplejwt.views import TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path("", RedirectView.as_view(url="/api/docs/", permanent=False)),
    path("healthz/", healthz),
    path("admin/", admin.site.urls),

    # AUTH
    path("api/register/", RegisterView.as_view()),
    path("api/token/", EmailTokenObtainPairView.as_view()),
    path("api/token/refresh/", TokenRefreshView.as_view()),
    path("api/password-reset/request/", RequestPasswordResetView.as_view()),
    path("api/password-reset/confirm/", ResetPasswordView.as_view()),

    # PROFILE
    path("api/users/me/", ProfileView.as_view()),
    path("api/users/me/change-password/", ChangePasswordView.as_view()),
    path("api/users/me/device-tokens/", DeviceTokenView.as_view()),
    path("api/users/me/device-tokens/<str:token>/", DeviceTokenDetailView.as_view()),

    # API DOCS
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),

    # APPS
    path("api/household/", include("household.urls")),
    path("api/fakras/", include("fakras.urls")),

    # MEDIA
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]