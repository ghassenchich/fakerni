from rest_framework.exceptions import PermissionDenied


def get_role(user, household):
    membership = household.memberships.filter(user=user).first()
    return membership.role if membership else None


def require_role(user, household, roles):
    role = get_role(user, household)

    if role not in roles:
        raise PermissionDenied(
            f"Requires role {roles}, got {role}"
        )