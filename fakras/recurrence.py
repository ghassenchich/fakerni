import calendar
from datetime import timedelta

from django.utils import timezone

from household.notifications import notify_household
from users.push import send_push_to_users

from .models import Fakra, Item
from .services import log_activity


def _add_months(dt, months):
    month = dt.month - 1 + months
    year = dt.year + month // 12
    month = month % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def _next_due_date(due_date, recurrence):
    if recurrence == "daily":
        return due_date + timedelta(days=1)
    if recurrence == "weekly":
        return due_date + timedelta(days=7)
    if recurrence == "monthly":
        return _add_months(due_date, 1)
    return due_date


def create_recurring_instances(now=None):
    """Archive every overdue recurring Fakra and create its next occurrence.

    Items are copied back to the new Fakra as pending. Returns the list of
    newly created Fakras.
    """
    now = now or timezone.now()

    due = list(Fakra.objects.due_for_recurrence())
    created = []

    for fakra in due:
        fakra.status = "archived"
        fakra.save(update_fields=["status"])
        log_activity(fakra, fakra.created_by, "fakra_archived", "Archived automatically (recurrence)")

        new_fakra = Fakra.objects.create(
            title=fakra.title,
            description=fakra.description,
            due_date=_next_due_date(fakra.due_date, fakra.recurrence),
            household=fakra.household,
            created_by=fakra.created_by,
            recurrence=fakra.recurrence,
            recurrence_parent=fakra,
        )

        for item in fakra.items.all():
            Item.objects.create(
                fakra=new_fakra,
                name=item.name,
                quantity=item.quantity,
                unit=item.unit,
                category=item.category,
                notes=item.notes,
                created_by=item.created_by,
            )

        log_activity(
            new_fakra,
            new_fakra.created_by,
            "fakra_recurred",
            f'Created from recurring Fakra "{fakra.title}"',
        )

        title = "New recurring Fakra"
        body = f'"{new_fakra.title}" is ready for its next occurrence'
        data = {"fakra_id": str(new_fakra.id), "type": "fakra.recurrence_created"}

        if new_fakra.household_id:
            notify_household(new_fakra.household_id, title, body, data=data)
        else:
            send_push_to_users([new_fakra.created_by], title, body, data=data)

        created.append(new_fakra)

    return created
