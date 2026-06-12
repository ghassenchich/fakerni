from django.contrib.auth import get_user_model
from django.utils import timezone

from datetime import timedelta

from rest_framework import status
from rest_framework.test import APITestCase

from household.models import Household, Membership
from .models import Fakra, Item, FakraAccess, ActivityLog

User = get_user_model()


class FakraTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@test.com", password="pass1234")
        self.member = User.objects.create_user(email="member@test.com", password="pass1234")
        self.outsider = User.objects.create_user(email="outsider@test.com", password="pass1234")

        self.household = Household.objects.create(name="Family", owner=self.owner)
        Membership.objects.create(user=self.owner, household=self.household, role="owner")
        Membership.objects.create(user=self.member, household=self.household, role="member")

    # --- Fakra CRUD ---

    def test_owner_can_create_household_fakra(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post("/api/fakras/", {
            "title": "Weekly groceries",
            "household": self.household.id,
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "active")

    def test_member_cannot_create_household_fakra(self):
        self.client.force_authenticate(self.member)
        response = self.client.post("/api/fakras/", {
            "title": "Weekly groceries",
            "household": self.household.id,
        })

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_personal_fakra(self):
        self.client.force_authenticate(self.member)
        response = self.client.post("/api/fakras/", {"title": "My personal list"})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data["household"])

    def test_title_too_short_is_rejected(self):
        self.client.force_authenticate(self.member)
        response = self.client.post("/api/fakras/", {"title": "ab"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_attach_fakra_to_household_without_membership(self):
        other_household = Household.objects.create(name="Other", owner=self.outsider)
        Membership.objects.create(user=self.outsider, household=other_household, role="owner")

        self.client.force_authenticate(self.member)
        response = self.client.post("/api/fakras/", {
            "title": "Sneaky list",
            "household": other_household.id,
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_member_cannot_see_household_fakra(self):
        fakra = Fakra.objects.create(title="Weekly groceries", household=self.household, created_by=self.owner)

        self.client.force_authenticate(self.outsider)
        response = self.client.get(f"/api/fakras/{fakra.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_member_can_see_household_fakra(self):
        fakra = Fakra.objects.create(title="Weekly groceries", household=self.household, created_by=self.owner)

        self.client.force_authenticate(self.member)
        response = self.client.get(f"/api/fakras/{fakra.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- Items ---

    def test_member_can_add_and_list_items(self):
        fakra = Fakra.objects.create(title="Weekly groceries", household=self.household, created_by=self.owner)

        self.client.force_authenticate(self.member)
        response = self.client.post(f"/api/fakras/{fakra.id}/items/", {
            "name": "Bread",
            "quantity": 5,
            "unit": "unit",
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "pending")

        response = self.client.get(f"/api/fakras/{fakra.id}/items/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        log = ActivityLog.objects.filter(fakra=fakra, action_type="item_added")
        self.assertTrue(log.exists())

    def test_outsider_cannot_add_items(self):
        fakra = Fakra.objects.create(title="Weekly groceries", household=self.household, created_by=self.owner)

        self.client.force_authenticate(self.outsider)
        response = self.client.post(f"/api/fakras/{fakra.id}/items/", {"name": "Bread"})

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_item_editable_by_creator(self):
        fakra = Fakra.objects.create(title="Weekly groceries", household=self.household, created_by=self.owner)
        item = Item.objects.create(fakra=fakra, name="Bread", created_by=self.member)

        self.client.force_authenticate(self.member)
        response = self.client.patch(f"/api/fakras/{fakra.id}/items/{item.id}/", {"name": "Baguette"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Baguette")

    def test_item_editable_by_fakra_creator(self):
        fakra = Fakra.objects.create(title="Weekly groceries", household=self.household, created_by=self.owner)
        item = Item.objects.create(fakra=fakra, name="Bread", created_by=self.member)

        self.client.force_authenticate(self.owner)
        response = self.client.delete(f"/api/fakras/{fakra.id}/items/{item.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_item_not_editable_by_other_member(self):
        other_member = User.objects.create_user(email="other@test.com", password="pass1234")
        Membership.objects.create(user=other_member, household=self.household, role="member")

        fakra = Fakra.objects.create(title="Weekly groceries", household=self.household, created_by=self.owner)
        item = Item.objects.create(fakra=fakra, name="Bread", created_by=self.member)

        self.client.force_authenticate(other_member)
        response = self.client.patch(f"/api/fakras/{fakra.id}/items/{item.id}/", {"name": "Baguette"})

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # --- Done / Undo ---

    def test_mark_item_done_and_undo(self):
        fakra = Fakra.objects.create(title="Weekly groceries", household=self.household, created_by=self.owner)
        item = Item.objects.create(fakra=fakra, name="Bread", created_by=self.member)

        self.client.force_authenticate(self.member)
        response = self.client.post(f"/api/fakras/{fakra.id}/items/{item.id}/done/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "done")
        self.assertEqual(response.data["done_by"], self.member.id)

        response = self.client.post(f"/api/fakras/{fakra.id}/items/{item.id}/undo/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "pending")
        self.assertIsNone(response.data["done_by"])

    def test_cannot_mark_already_done_item_done(self):
        fakra = Fakra.objects.create(title="Weekly groceries", household=self.household, created_by=self.owner)
        item = Item.objects.create(
            fakra=fakra, name="Bread", created_by=self.member,
            status="done", done_by=self.member, done_at=timezone.now()
        )

        self.client.force_authenticate(self.member)
        response = self.client.post(f"/api/fakras/{fakra.id}/items/{item.id}/done/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_undo_after_window_expires(self):
        fakra = Fakra.objects.create(title="Weekly groceries", household=self.household, created_by=self.owner)
        item = Item.objects.create(
            fakra=fakra, name="Bread", created_by=self.member,
            status="done", done_by=self.member,
            done_at=timezone.now() - timedelta(minutes=11)
        )

        self.client.force_authenticate(self.member)
        response = self.client.post(f"/api/fakras/{fakra.id}/items/{item.id}/undo/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        item.refresh_from_db()
        self.assertEqual(item.status, "done")

    # --- Archive ---

    def test_creator_can_archive_fakra(self):
        fakra = Fakra.objects.create(title="Weekly groceries", household=self.household, created_by=self.member)

        self.client.force_authenticate(self.member)
        response = self.client.post(f"/api/fakras/{fakra.id}/archive/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "archived")

    def test_household_admin_can_archive_fakra(self):
        fakra = Fakra.objects.create(title="Weekly groceries", household=self.household, created_by=self.member)

        self.client.force_authenticate(self.owner)
        response = self.client.post(f"/api/fakras/{fakra.id}/archive/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_plain_member_cannot_archive_others_fakra(self):
        other_member = User.objects.create_user(email="other@test.com", password="pass1234")
        Membership.objects.create(user=other_member, household=self.household, role="member")

        fakra = Fakra.objects.create(title="Weekly groceries", household=self.household, created_by=self.member)

        self.client.force_authenticate(other_member)
        response = self.client.post(f"/api/fakras/{fakra.id}/archive/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_filter_fakras_by_archived_status(self):
        active = Fakra.objects.create(title="Active list", household=self.household, created_by=self.member)
        archived = Fakra.objects.create(
            title="Old list", household=self.household, created_by=self.member, status="archived"
        )

        self.client.force_authenticate(self.member)
        response = self.client.get("/api/fakras/", {"status": "archived"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = [item["id"] for item in response.data["results"]]
        self.assertIn(archived.id, returned_ids)
        self.assertNotIn(active.id, returned_ids)

    # --- Activity log ---

    def test_activity_log_records_events(self):
        fakra = Fakra.objects.create(title="Weekly groceries", household=self.household, created_by=self.member)
        item = Item.objects.create(fakra=fakra, name="Bread", created_by=self.member)

        self.client.force_authenticate(self.member)
        self.client.post(f"/api/fakras/{fakra.id}/items/{item.id}/done/")

        response = self.client.get(f"/api/fakras/{fakra.id}/activity/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        action_types = [entry["action_type"] for entry in response.data]
        self.assertIn("item_done", action_types)

    # --- Sharing ---

    def test_creator_can_share_personal_fakra(self):
        fakra = Fakra.objects.create(title="My personal list", household=None, created_by=self.member)

        self.client.force_authenticate(self.member)
        response = self.client.post(
            f"/api/fakras/{fakra.id}/share/",
            {"user_ids": [self.outsider.id]},
            format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(FakraAccess.objects.filter(fakra=fakra, user=self.outsider).exists())

    def test_shared_user_can_access_personal_fakra(self):
        fakra = Fakra.objects.create(title="My personal list", household=None, created_by=self.member)
        FakraAccess.objects.create(fakra=fakra, user=self.outsider)

        self.client.force_authenticate(self.outsider)
        response = self.client.get(f"/api/fakras/{fakra.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_non_shared_user_cannot_access_personal_fakra(self):
        fakra = Fakra.objects.create(title="My personal list", household=None, created_by=self.member)

        self.client.force_authenticate(self.outsider)
        response = self.client.get(f"/api/fakras/{fakra.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
