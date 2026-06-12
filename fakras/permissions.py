from rest_framework.exceptions import PermissionDenied


def user_can_access_fakra(user, fakra):
    if fakra.created_by_id == user.id:
        return True

    if fakra.household_id and fakra.household.memberships.filter(user=user).exists():
        return True

    if fakra.access.filter(user=user).exists():
        return True

    return False


def require_fakra_access(user, fakra):
    if not user_can_access_fakra(user, fakra):
        raise PermissionDenied("You do not have access to this Fakra")
