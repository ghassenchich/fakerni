from django.db import models
from django.conf import settings


class Fakra(models.Model):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("archived", "Archived"),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default="active"
    )

    due_date = models.DateTimeField(blank=True, null=True)

    household = models.ForeignKey(
        "household.Household",
        on_delete=models.CASCADE,
        related_name="fakras",
        null=True,
        blank=True
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_fakras"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class FakraAccess(models.Model):
    fakra = models.ForeignKey(
        Fakra,
        on_delete=models.CASCADE,
        related_name="access"
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="fakra_access"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("fakra", "user")

    def __str__(self):
        return f"{self.user.email} -> {self.fakra.title}"


class Item(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("done", "Done"),
    ]

    fakra = models.ForeignKey(
        Fakra,
        on_delete=models.CASCADE,
        related_name="items"
    )

    name = models.CharField(max_length=200)
    quantity = models.IntegerField(default=1)
    unit = models.CharField(max_length=50, blank=True, null=True)
    category = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default="pending"
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_items"
    )

    done_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="done_items",
        null=True,
        blank=True
    )

    done_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return self.name


class ActivityLog(models.Model):
    fakra = models.ForeignKey(
        Fakra,
        on_delete=models.CASCADE,
        related_name="activity_logs"
    )

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="fakra_activity_logs"
    )

    action_type = models.CharField(max_length=50)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action_type} on {self.fakra.title}"
