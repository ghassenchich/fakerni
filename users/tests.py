from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.db import connection
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle

from .models import PasswordResetOTP, DeviceToken

User = get_user_model()


class AuthTests(APITestCase):
    def test_register_user(self):
        response = self.client.post("/api/register/", {
            "email": "new@test.com",
            "password": "pass1234",
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email="new@test.com").exists())

    def test_register_duplicate_email_rejected(self):
        User.objects.create_user(email="dup@test.com", password="pass1234")

        response = self.client.post("/api/register/", {
            "email": "dup@test.com",
            "password": "pass1234",
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_returns_jwt_pair(self):
        User.objects.create_user(email="login@test.com", password="pass1234")

        response = self.client.post("/api/token/", {
            "email": "login@test.com",
            "password": "pass1234",
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_invalid_credentials(self):
        User.objects.create_user(email="login2@test.com", password="pass1234")

        response = self.client.post("/api/token/", {
            "email": "login2@test.com",
            "password": "wrongpass",
        })

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class PasswordResetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="reset@test.com", password="oldpass123")

    def test_request_reset_sends_email_for_existing_user(self):
        response = self.client.post("/api/password-reset/request/", {
            "email": "reset@test.com",
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(PasswordResetOTP.objects.filter(user=self.user).exists())

    def test_request_reset_unknown_email_does_not_leak(self):
        response = self.client.post("/api/password-reset/request/", {
            "email": "doesnotexist@test.com",
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

    def test_confirm_reset_with_valid_code(self):
        otp = PasswordResetOTP.generate_for_user(self.user)

        response = self.client.post("/api/password-reset/confirm/", {
            "email": "reset@test.com",
            "code": otp.code,
            "new_password": "newpass123",
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        login = self.client.post("/api/token/", {
            "email": "reset@test.com",
            "password": "newpass123",
        })
        self.assertEqual(login.status_code, status.HTTP_200_OK)

    def test_confirm_reset_with_wrong_code_fails(self):
        PasswordResetOTP.generate_for_user(self.user)

        response = self.client.post("/api/password-reset/confirm/", {
            "email": "reset@test.com",
            "code": "000000",
            "new_password": "newpass123",
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_reset_with_expired_code_fails(self):
        otp = PasswordResetOTP.generate_for_user(self.user)
        PasswordResetOTP.objects.filter(pk=otp.pk).update(
            created_at=timezone.now() - timedelta(minutes=11)
        )

        response = self.client.post("/api/password-reset/confirm/", {
            "email": "reset@test.com",
            "code": otp.code,
            "new_password": "newpass123",
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_reset_code_cannot_be_reused(self):
        otp = PasswordResetOTP.generate_for_user(self.user)

        first = self.client.post("/api/password-reset/confirm/", {
            "email": "reset@test.com",
            "code": otp.code,
            "new_password": "newpass123",
        })
        self.assertEqual(first.status_code, status.HTTP_200_OK)

        second = self.client.post("/api/password-reset/confirm/", {
            "email": "reset@test.com",
            "code": otp.code,
            "new_password": "anotherpass456",
        })
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)


class ProfileTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="profile@test.com", password="pass1234", name="Original Name")
        self.client.force_authenticate(self.user)

    def test_get_profile(self):
        response = self.client.get("/api/users/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "profile@test.com")
        self.assertEqual(response.data["name"], "Original Name")

    def test_update_profile_name(self):
        response = self.client.patch("/api/users/me/", {"name": "New Name"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.name, "New Name")

    def test_email_is_read_only(self):
        response = self.client.patch("/api/users/me/", {"email": "changed@test.com"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "profile@test.com")

    def test_profile_requires_authentication(self):
        self.client.force_authenticate(None)
        response = self.client.get("/api/users/me/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ChangePasswordTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="changepw@test.com", password="oldpass123")
        self.client.force_authenticate(self.user)

    def test_change_password_success(self):
        response = self.client.post("/api/users/me/change-password/", {
            "old_password": "oldpass123",
            "new_password": "newpass456",
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(None)
        login = self.client.post("/api/token/", {
            "email": "changepw@test.com",
            "password": "newpass456",
        })
        self.assertEqual(login.status_code, status.HTTP_200_OK)

    def test_change_password_wrong_old_password(self):
        response = self.client.post("/api/users/me/change-password/", {
            "old_password": "wrongpass",
            "new_password": "newpass456",
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class DeviceTokenTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="device@test.com", password="pass1234")
        self.client.force_authenticate(self.user)

    def test_register_device_token(self):
        response = self.client.post("/api/users/me/device-tokens/", {
            "token": "fcm-token-123",
            "platform": "android",
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            DeviceToken.objects.filter(
                user=self.user, token_hash=DeviceToken.hash_token("fcm-token-123")
            ).exists()
        )

    def test_re_registering_same_token_updates_owner(self):
        other_user = User.objects.create_user(email="other@test.com", password="pass1234")
        DeviceToken.objects.create(user=other_user, token="shared-token", platform="ios")

        response = self.client.post("/api/users/me/device-tokens/", {
            "token": "shared-token",
            "platform": "ios",
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        token = DeviceToken.objects.get(token_hash=DeviceToken.hash_token("shared-token"))
        self.assertEqual(token.user, self.user)

    def test_list_device_tokens(self):
        DeviceToken.objects.create(user=self.user, token="tok-1", platform="android")

        response = self.client.get("/api/users/me/device-tokens/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_delete_device_token(self):
        DeviceToken.objects.create(user=self.user, token="tok-to-delete", platform="web")

        response = self.client.delete("/api/users/me/device-tokens/tok-to-delete/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            DeviceToken.objects.filter(token_hash=DeviceToken.hash_token("tok-to-delete")).exists()
        )


class PushNotificationTests(APITestCase):
    def test_send_push_is_noop_without_firebase_credentials(self):
        from .push import send_push_to_users

        user = User.objects.create_user(email="push@test.com", password="pass1234")
        DeviceToken.objects.create(user=user, token="tok-1", platform="android")

        # Should not raise even though FIREBASE_CREDENTIALS_PATH is unset.
        send_push_to_users([user], "Title", "Body")


class ThrottleTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.original_rates = ScopedRateThrottle.THROTTLE_RATES
        ScopedRateThrottle.THROTTLE_RATES = {**self.original_rates, "login": "2/minute"}
        self.addCleanup(setattr, ScopedRateThrottle, "THROTTLE_RATES", self.original_rates)

        self.user = User.objects.create_user(email="throttle@test.com", password="pass1234")

    def test_login_endpoint_is_rate_limited(self):
        for _ in range(2):
            response = self.client.post("/api/token/", {
                "email": "throttle@test.com",
                "password": "pass1234",
            })
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post("/api/token/", {
            "email": "throttle@test.com",
            "password": "pass1234",
        })
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class EncryptionAtRestTests(APITestCase):
    def _raw_value(self, table, column, pk):
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT {column} FROM {table} WHERE id = %s", [pk])
            return cursor.fetchone()[0]

    def test_device_token_is_encrypted_at_rest(self):
        user = User.objects.create_user(email="encrypted-token@test.com", password="pass1234")
        device_token = DeviceToken.objects.create(user=user, token="fcm-secret-token", platform="android")

        raw = self._raw_value("users_devicetoken", "token", device_token.pk)
        self.assertNotEqual(raw, "fcm-secret-token")

        device_token.refresh_from_db()
        self.assertEqual(device_token.token, "fcm-secret-token")

    def test_otp_code_is_encrypted_at_rest(self):
        user = User.objects.create_user(email="encrypted-otp@test.com", password="pass1234")
        otp = PasswordResetOTP.generate_for_user(user)

        raw = self._raw_value("users_passwordresetotp", "code", otp.pk)
        self.assertNotEqual(raw, otp.code)

        otp.refresh_from_db()
        self.assertEqual(len(otp.code), 6)
