from django.contrib.auth import get_user_model

from users.push import send_push_to_users

User = get_user_model()


def notify_household(household_id, title, body, data=None, exclude_user_id=None):
    """Send a push notification to every member of a household.

    No-op if Firebase isn't configured (see users/push.py) or if the
    household has no members with registered device tokens.
    """
    users = User.objects.filter(membership__household_id=household_id)

    if exclude_user_id is not None:
        users = users.exclude(id=exclude_user_id)

    send_push_to_users(users, title, body, data)
