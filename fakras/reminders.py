from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from household.notifications import notify_household
from users.push import send_push_to_users

from .models import Fakra


def send_due_date_reminders(now=None):
    """Send a one-time reminder for every active Fakra whose due_date falls
    within the configured reminder window and hasn't been reminded yet.

    Returns the list of Fakras that were notified.
    """
    now = now or timezone.now()
    window = timedelta(hours=settings.FAKRA_REMINDER_WINDOW_HOURS)

    due_soon = list(Fakra.objects.due_soon(window))

    for fakra in due_soon:
        title = "Fakra due soon"
        body = f'"{fakra.title}" is due {fakra.due_date.strftime("%Y-%m-%d %H:%M")}'
        data = {"fakra_id": str(fakra.id), "type": "fakra.due_soon"}

        if fakra.household_id:
            notify_household(fakra.household_id, title, body, data=data)
        else:
            send_push_to_users([fakra.created_by], title, body, data=data)

        fakra.reminder_sent_at = now
        fakra.save(update_fields=["reminder_sent_at"])

    return due_soon
