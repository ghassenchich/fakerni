from django.contrib.auth import get_user_model

from users.push import send_push_to_users

User = get_user_model()


def notify_fakra_access(fakra, title, body, data=None, exclude_user_id=None):
    user_ids = set(fakra.access.values_list("user_id", flat=True))

    if not fakra.household_id:
        user_ids.add(fakra.created_by_id)

    if exclude_user_id is not None:
        user_ids.discard(exclude_user_id)

    if not user_ids:
        return

    send_push_to_users(User.objects.filter(id__in=user_ids), title, body, data)
