from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from datetime import timedelta

from rest_framework import status
from rest_framework.test import APITestCase

from .models import Household, Membership

User = get_user_model()


class HouseholdTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@test.com", password="pass1234")
        self.member = User.objects.create_user(email="member@test.com", password="pass1234")
        self.outsider = User.objects.create_user(email="outsider@test.com", password="pass1234")

    def create_household(self, user):
        self.client.force_authenticate(user)
        response = self.client.post("/api/household/households/", {"name": "Family"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def test_create_household_creates_owner_membership(self):
        data = self.create_household(self.owner)
        household = Household.objects.get(pk=data["id"])

        membership = Membership.objects.get(household=household, user=self.owner)
        self.assertEqual(membership.role, "owner")

    def test_join_household_with_valid_code(self):
        data = self.create_household(self.owner)
        household = Household.objects.get(pk=data["id"])

        self.client.force_authenticate(self.member)
        response = self.client.post("/api/household/join/", {"invite_code": household.invite_code})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Membership.objects.filter(household=household, user=self.member).exists())

    def test_join_household_already_member(self):
        data = self.create_household(self.owner)
        household = Household.objects.get(pk=data["id"])

        self.client.force_authenticate(self.owner)
        response = self.client.post("/api/household/join/", {"invite_code": household.invite_code})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Already joined")

    def test_join_household_invalid_code(self):
        self.client.force_authenticate(self.member)
        response = self.client.post("/api/household/join/", {"invite_code": "bogus"})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_join_household_expired_code(self):
        data = self.create_household(self.owner)
        household = Household.objects.get(pk=data["id"])

        household.invite_expires_at = timezone.now() - timedelta(hours=1)
        household.save()

        self.client.force_authenticate(self.member)
        response = self.client.post("/api/household/join/", {"invite_code": household.invite_code})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_regenerate_invite(self):
        data = self.create_household(self.owner)
        household = Household.objects.get(pk=data["id"])
        old_code = household.invite_code

        self.client.force_authenticate(self.owner)
        response = self.client.post(f"/api/household/{household.id}/regenerate-invite/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotEqual(response.data["invite_code"], old_code)

    def test_update_member_role_and_ownership_transfer(self):
        data = self.create_household(self.owner)
        household = Household.objects.get(pk=data["id"])

        self.client.force_authenticate(self.member)
        self.client.post("/api/household/join/", {"invite_code": household.invite_code})
        member_membership = Membership.objects.get(household=household, user=self.member)

        self.client.force_authenticate(self.owner)
        response = self.client.post(
            f"/api/household/members/{member_membership.id}/role/",
            {"role": "owner"}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        member_membership.refresh_from_db()
        owner_membership = Membership.objects.get(household=household, user=self.owner)

        self.assertEqual(member_membership.role, "owner")
        self.assertEqual(owner_membership.role, "admin")

    def test_list_members(self):
        data = self.create_household(self.owner)
        household = Household.objects.get(pk=data["id"])

        self.client.force_authenticate(self.member)
        self.client.post("/api/household/join/", {"invite_code": household.invite_code})

        response = self.client.get(f"/api/household/{household.id}/members/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_list_members_requires_membership(self):
        data = self.create_household(self.owner)
        household = Household.objects.get(pk=data["id"])

        self.client.force_authenticate(self.outsider)
        response = self.client.get(f"/api/household/{household.id}/members/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_can_leave_household(self):
        data = self.create_household(self.owner)
        household = Household.objects.get(pk=data["id"])

        self.client.force_authenticate(self.member)
        self.client.post("/api/household/join/", {"invite_code": household.invite_code})

        response = self.client.delete(f"/api/household/{household.id}/members/{self.member.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Membership.objects.filter(household=household, user=self.member).exists())

    def test_owner_cannot_leave_without_transferring_ownership(self):
        data = self.create_household(self.owner)
        household = Household.objects.get(pk=data["id"])

        self.client.force_authenticate(self.owner)
        response = self.client.delete(f"/api/household/{household.id}/members/{self.owner.id}/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Membership.objects.filter(household=household, user=self.owner).exists())

    def test_owner_can_remove_member(self):
        data = self.create_household(self.owner)
        household = Household.objects.get(pk=data["id"])

        self.client.force_authenticate(self.member)
        self.client.post("/api/household/join/", {"invite_code": household.invite_code})

        self.client.force_authenticate(self.owner)
        response = self.client.delete(f"/api/household/{household.id}/members/{self.member.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Membership.objects.filter(household=household, user=self.member).exists())

    def test_member_cannot_remove_other_member(self):
        data = self.create_household(self.owner)
        household = Household.objects.get(pk=data["id"])

        self.client.force_authenticate(self.member)
        self.client.post("/api/household/join/", {"invite_code": household.invite_code})

        other_member = User.objects.create_user(email="other@test.com", password="pass1234")
        self.client.force_authenticate(other_member)
        self.client.post("/api/household/join/", {"invite_code": household.invite_code})

        self.client.force_authenticate(self.member)
        response = self.client.delete(f"/api/household/{household.id}/members/{other_member.id}/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_cannot_be_removed_by_admin(self):
        data = self.create_household(self.owner)
        household = Household.objects.get(pk=data["id"])

        self.client.force_authenticate(self.member)
        self.client.post("/api/household/join/", {"invite_code": household.invite_code})
        member_membership = Membership.objects.get(household=household, user=self.member)
        member_membership.role = "admin"
        member_membership.save()

        self.client.force_authenticate(self.member)
        response = self.client.delete(f"/api/household/{household.id}/members/{self.owner.id}/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class HouseholdBalancesTests(APITestCase):
    def setUp(self):
        from decimal import Decimal
        self.Decimal = Decimal
        self.a = get_user_model().objects.create_user(email="a@test.com", password="pass1234")
        self.b = get_user_model().objects.create_user(email="b@test.com", password="pass1234")
        self.c = get_user_model().objects.create_user(email="c@test.com", password="pass1234")
        self.outsider = get_user_model().objects.create_user(email="out@test.com", password="pass1234")

        self.household = Household.objects.create(name="Trip", owner=self.a)
        for u in (self.a, self.b, self.c):
            Membership.objects.create(user=u, household=self.household, role="owner" if u == self.a else "member")

    def _done(self, who, price):
        from fakras.models import Fakra, Item
        fakra = Fakra.objects.create(title="Shop", household=self.household, created_by=who)
        Item.objects.create(
            fakra=fakra, name="Thing", quantity=1, estimated_price=self.Decimal(str(price)),
            created_by=who, status="done", done_by=who, done_at=timezone.now(),
        )

    def test_balances_and_settlements(self):
        # A paid 90, B and C paid nothing. Total 90, fair share 30 each.
        self._done(self.a, "90.00")

        self.client.force_authenticate(self.a)
        r = self.client.get(f"/api/household/{self.household.id}/balances/")

        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(float(r.data["total"]), 90.0)
        self.assertEqual(r.data["member_count"], 3)

        by_email = {m["email"]: m for m in r.data["per_member"]}
        self.assertEqual(by_email["a@test.com"]["balance"], 60.0)   # paid 90 - share 30
        self.assertEqual(by_email["b@test.com"]["balance"], -30.0)
        self.assertEqual(by_email["c@test.com"]["balance"], -30.0)

        # B and C each owe A 30.
        settlements = r.data["settlements"]
        self.assertEqual(len(settlements), 2)
        for s in settlements:
            self.assertEqual(s["to"], "a@test.com")
            self.assertEqual(s["amount"], 30.0)

    def test_non_member_forbidden(self):
        self.client.force_authenticate(self.outsider)
        r = self.client.get(f"/api/household/{self.household.id}/balances/")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_no_spend_is_zero(self):
        self.client.force_authenticate(self.a)
        r = self.client.get(f"/api/household/{self.household.id}/balances/")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(float(r.data["total"]), 0.0)
        self.assertEqual(r.data["settlements"], [])
