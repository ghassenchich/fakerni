import secrets
from .models import Membership


def generate_invite_code():
    return secrets.token_hex(3)


def add_member(user, household, role="member"):
    obj, _ = Membership.objects.get_or_create(
        user=user,
        household=household,
        defaults={"role": role}
    )
    return obj


def remove_member(user, household):
    Membership.objects.filter(user=user, household=household).delete()