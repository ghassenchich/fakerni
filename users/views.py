import secrets

from django.contrib.auth import get_user_model
from django.core.mail import send_mail

from drf_spectacular.utils import extend_schema

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import PasswordResetOTP, DeviceToken
from .serializers import (
    RegisterSerializer,
    EmailTokenObtainPairSerializer,
    RequestPasswordResetSerializer,
    ResetPasswordSerializer,
    UserProfileSerializer,
    ChangePasswordSerializer,
    DeviceTokenSerializer,
)

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class RequestPasswordResetView(APIView):
    permission_classes = [AllowAny]
    serializer_class = RequestPasswordResetSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = RequestPasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]
        user = User.objects.filter(email__iexact=email).first()

        if user:
            otp = PasswordResetOTP.generate_for_user(user)
            send_mail(
                "Fakerni password reset code",
                f"Your password reset code is {otp.code}. It expires in 10 minutes.",
                None,
                [user.email],
            )

        return Response(
            {"detail": "If an account with that email exists, a reset code has been sent."}
        )


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    serializer_class = ResetPasswordSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = User.objects.filter(email__iexact=data["email"]).first()
        otp = None

        if user:
            otp = next(
                (
                    candidate
                    for candidate in user.password_reset_otps.filter(used=False).order_by("-created_at")
                    if secrets.compare_digest(candidate.code, data["code"])
                ),
                None,
            )

        if not user or not otp or not otp.is_valid():
            return Response(
                {"error": "Invalid or expired code"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(data["new_password"])
        user.save()

        otp.used = True
        otp.save()

        return Response({"detail": "Password has been reset"})


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ChangePasswordSerializer

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = request.user

        if not user.check_password(data["old_password"]):
            return Response(
                {"error": "Current password is incorrect"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(data["new_password"])
        user.save()

        return Response({"detail": "Password updated"})


class DeviceTokenView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DeviceTokenSerializer

    def get(self, request):
        tokens = request.user.device_tokens.all()
        return Response(DeviceTokenSerializer(tokens, many=True).data)

    def post(self, request):
        serializer = DeviceTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data["token"]
        device_token, _ = DeviceToken.objects.update_or_create(
            token_hash=DeviceToken.hash_token(token),
            defaults={
                "token": token,
                "user": request.user,
                "platform": serializer.validated_data["platform"],
            },
        )

        return Response(
            DeviceTokenSerializer(device_token).data,
            status=status.HTTP_201_CREATED
        )


class DeviceTokenDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={204: None})
    def delete(self, request, token):
        DeviceToken.objects.filter(user=request.user, token_hash=DeviceToken.hash_token(token)).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)