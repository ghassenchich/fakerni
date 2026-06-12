from django.utils import timezone
from .models import ActivityLog


def log_activity(fakra, actor, action_type, description):
    return ActivityLog.objects.create(
        fakra=fakra,
        actor=actor,
        action_type=action_type,
        description=description,
    )


def mark_item_done(item, user):
    item.status = "done"
    item.done_by = user
    item.done_at = timezone.now()
    item.save()
    return item


def undo_item(item):
    item.status = "pending"
    item.done_by = None
    item.done_at = None
    item.save()
    return item