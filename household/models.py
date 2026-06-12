from django.conf import settings
from django.db import models
from django.utils import timezone

from datetime import timedelta
import secrets


class Household(models.Model):
    name = models.CharField(max_length=100)

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

    invite_code = models.CharField(
        max_length=8,
        unique=True,
        blank=True
    )

    invite_expires_at = models.DateTimeField(
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.invite_code:
            self.invite_code = secrets.token_hex(4)
            self.invite_expires_at = timezone.now() + timedelta(hours=24)

        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Membership(models.Model):
    ROLE_CHOICES = [
        ("owner", "Owner"),
        ("admin", "Admin"),
        ("member", "Member"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )

    household = models.ForeignKey(
        Household,
        on_delete=models.CASCADE,
        related_name="memberships"
    )

    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES,
        default="member"
    )

    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "household")

        indexes = [
            models.Index(fields=["user", "household"]),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["household"],
                condition=models.Q(role="owner"),
                name="one_owner_per_household"
            )
        ]

    def __str__(self):
        return f"{self.user.email} - {self.household.name}"