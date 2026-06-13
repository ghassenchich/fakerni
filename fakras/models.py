from django.db import models
from django.conf import settings
from django.utils import timezone


class FakraQuerySet(models.QuerySet):
    def due_soon(self, within):
        now = timezone.now()
        return self.filter(
            status="active",
            due_date__isnull=False,
            due_date__gte=now,
            due_date__lte=now + within,
            reminder_sent_at__isnull=True,
        )

    def overdue(self):
        now = timezone.now()
        return self.filter(
            status="active",
            due_date__isnull=False,
            due_date__lt=now,
        )

    def due_for_recurrence(self):
        now = timezone.now()
        return self.filter(
            status="active",
            due_date__isnull=False,
            due_date__lt=now,
        ).exclude(recurrence="none")


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
    reminder_sent_at = models.DateTimeField(blank=True, null=True)

    RECURRENCE_CHOICES = [
        ("none", "None"),
        ("daily", "Daily"),
        ("weekly", "Weekly"),
        ("monthly", "Monthly"),
    ]

    recurrence = models.CharField(
        max_length=10,
        choices=RECURRENCE_CHOICES,
        default="none",
    )

    recurrence_parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="recurrence_children",
        null=True,
        blank=True,
    )

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

    objects = FakraQuerySet.as_manager()

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


def item_attachment_upload_path(instance, filename):
    return f"fakras/{instance.item.fakra_id}/items/{instance.item_id}/{filename}"


class ItemAttachment(models.Model):
    item = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name="attachments"
    )

    file = models.ImageField(upload_to=item_attachment_upload_path)

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="uploaded_attachments",
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Attachment for {self.item.name}"


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
