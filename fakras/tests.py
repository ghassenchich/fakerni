import io
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from datetime import datetime, timedelta

from PIL import Image

from rest_framework import status
from rest_framework.test import APITestCase

from household.models import Household, Membership
from .models import Fakra, Item, ItemAttachment, FakraAccess, ActivityLog
from .reminders import send_due_date_reminders
from .recurrence import create_recurring_instances, _add_months, _next_due_date
from .views import MAX_ATTACHMENT_SIZE


def make_image_file(name="test.png", color=(255, 0, 0)):
    buf = io.BytesIO()
    Image.new("RGB", (10, 10), color).save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/png")

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


class DueDateReminderTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@test.com", password="pass1234")
        self.member = User.objects.create_user(email="member@test.com", password="pass1234")

        self.household = Household.objects.create(name="Family", owner=self.owner)
        Membership.objects.create(user=self.owner, household=self.household, role="owner")
        Membership.objects.create(user=self.member, household=self.household, role="member")

    # --- Queryset helpers ---

    def test_due_soon_and_overdue_querysets(self):
        now = timezone.now()

        soon = Fakra.objects.create(
            title="Due soon", created_by=self.member, due_date=now + timedelta(hours=2)
        )
        overdue = Fakra.objects.create(
            title="Overdue", created_by=self.member, due_date=now - timedelta(hours=2)
        )
        far_off = Fakra.objects.create(
            title="Far off", created_by=self.member, due_date=now + timedelta(days=10)
        )
        no_due_date = Fakra.objects.create(title="No due date", created_by=self.member)

        due_soon_ids = [f.id for f in Fakra.objects.due_soon(timedelta(hours=24))]
        self.assertIn(soon.id, due_soon_ids)
        self.assertNotIn(overdue.id, due_soon_ids)
        self.assertNotIn(far_off.id, due_soon_ids)
        self.assertNotIn(no_due_date.id, due_soon_ids)

        overdue_ids = [f.id for f in Fakra.objects.overdue()]
        self.assertIn(overdue.id, overdue_ids)
        self.assertNotIn(soon.id, overdue_ids)
        self.assertNotIn(no_due_date.id, overdue_ids)

    # --- send_due_date_reminders ---

    @patch("fakras.reminders.send_push_to_users")
    def test_reminder_sent_for_personal_fakra(self, mock_send_push):
        fakra = Fakra.objects.create(
            title="Personal list", created_by=self.member,
            due_date=timezone.now() + timedelta(hours=1)
        )

        notified = send_due_date_reminders()

        self.assertEqual([f.id for f in notified], [fakra.id])
        mock_send_push.assert_called_once()
        self.assertEqual(list(mock_send_push.call_args[0][0]), [self.member])

        fakra.refresh_from_db()
        self.assertIsNotNone(fakra.reminder_sent_at)

        # Running again should not re-notify the same Fakra.
        mock_send_push.reset_mock()
        notified_again = send_due_date_reminders()
        self.assertEqual(notified_again, [])
        mock_send_push.assert_not_called()

    @patch("fakras.reminders.notify_household")
    def test_reminder_sent_for_household_fakra(self, mock_notify_household):
        fakra = Fakra.objects.create(
            title="Household list", household=self.household, created_by=self.owner,
            due_date=timezone.now() + timedelta(hours=1)
        )

        notified = send_due_date_reminders()

        self.assertEqual([f.id for f in notified], [fakra.id])
        mock_notify_household.assert_called_once()
        self.assertEqual(mock_notify_household.call_args[0][0], self.household.id)

        fakra.refresh_from_db()
        self.assertIsNotNone(fakra.reminder_sent_at)

    # --- reset on due_date change ---

    def test_updating_due_date_resets_reminder_sent_at(self):
        fakra = Fakra.objects.create(
            title="Personal list", created_by=self.member,
            due_date=timezone.now() + timedelta(hours=1),
            reminder_sent_at=timezone.now(),
        )

        self.client.force_authenticate(self.member)
        response = self.client.patch(f"/api/fakras/{fakra.id}/", {
            "due_date": (timezone.now() + timedelta(days=2)).isoformat(),
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        fakra.refresh_from_db()
        self.assertIsNone(fakra.reminder_sent_at)


class RecurringFakraTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@test.com", password="pass1234")
        self.member = User.objects.create_user(email="member@test.com", password="pass1234")

        self.household = Household.objects.create(name="Family", owner=self.owner)
        Membership.objects.create(user=self.owner, household=self.household, role="owner")
        Membership.objects.create(user=self.member, household=self.household, role="member")

    # --- date math ---

    def test_add_months_clamps_to_end_of_month(self):
        jan_31 = timezone.make_aware(datetime(2026, 1, 31, 10, 0))
        feb_28 = timezone.make_aware(datetime(2026, 2, 28, 10, 0))
        self.assertEqual(_add_months(jan_31, 1), feb_28)

    def test_next_due_date(self):
        now = timezone.make_aware(datetime(2026, 6, 1, 10, 0))
        self.assertEqual(_next_due_date(now, "daily"), now + timedelta(days=1))
        self.assertEqual(_next_due_date(now, "weekly"), now + timedelta(days=7))
        self.assertEqual(_next_due_date(now, "monthly"), timezone.make_aware(datetime(2026, 7, 1, 10, 0)))

    # --- due_for_recurrence queryset ---

    def test_due_for_recurrence_queryset(self):
        now = timezone.now()

        overdue_recurring = Fakra.objects.create(
            title="Weekly groceries", created_by=self.member,
            due_date=now - timedelta(hours=2), recurrence="weekly",
        )
        overdue_non_recurring = Fakra.objects.create(
            title="One-off", created_by=self.member,
            due_date=now - timedelta(hours=2), recurrence="none",
        )
        future_recurring = Fakra.objects.create(
            title="Future", created_by=self.member,
            due_date=now + timedelta(hours=2), recurrence="weekly",
        )
        archived_recurring = Fakra.objects.create(
            title="Archived", created_by=self.member,
            due_date=now - timedelta(hours=2), recurrence="weekly", status="archived",
        )

        due_ids = [f.id for f in Fakra.objects.due_for_recurrence()]
        self.assertIn(overdue_recurring.id, due_ids)
        self.assertNotIn(overdue_non_recurring.id, due_ids)
        self.assertNotIn(future_recurring.id, due_ids)
        self.assertNotIn(archived_recurring.id, due_ids)

    # --- create_recurring_instances ---

    @patch("fakras.recurrence.send_push_to_users")
    def test_recurring_personal_fakra_creates_next_occurrence(self, mock_send_push):
        due_date = timezone.now() - timedelta(hours=1)
        fakra = Fakra.objects.create(
            title="Weekly groceries", created_by=self.member,
            due_date=due_date, recurrence="weekly",
        )
        Item.objects.create(fakra=fakra, name="Milk", created_by=self.member)
        Item.objects.create(
            fakra=fakra, name="Bread", created_by=self.member,
            status="done", done_by=self.member, done_at=timezone.now(),
        )

        created = create_recurring_instances()

        self.assertEqual(len(created), 1)
        new_fakra = created[0]

        fakra.refresh_from_db()
        self.assertEqual(fakra.status, "archived")

        self.assertEqual(new_fakra.status, "active")
        self.assertEqual(new_fakra.title, fakra.title)
        self.assertEqual(new_fakra.recurrence, "weekly")
        self.assertEqual(new_fakra.recurrence_parent_id, fakra.id)
        self.assertEqual(new_fakra.due_date, due_date + timedelta(days=7))

        new_items = list(new_fakra.items.all())
        self.assertEqual(len(new_items), 2)
        self.assertTrue(all(item.status == "pending" for item in new_items))
        self.assertTrue(all(item.done_by is None for item in new_items))
        self.assertEqual({item.name for item in new_items}, {"Milk", "Bread"})

        mock_send_push.assert_called_once()
        self.assertEqual(list(mock_send_push.call_args[0][0]), [self.member])

        # Running again should not double-create — the new instance isn't overdue.
        mock_send_push.reset_mock()
        created_again = create_recurring_instances()
        self.assertEqual(created_again, [])
        mock_send_push.assert_not_called()

    @patch("fakras.recurrence.notify_household")
    def test_recurring_household_fakra_notifies_household(self, mock_notify_household):
        fakra = Fakra.objects.create(
            title="Monthly bills", household=self.household, created_by=self.owner,
            due_date=timezone.now() - timedelta(hours=1), recurrence="monthly",
        )

        created = create_recurring_instances()

        self.assertEqual(len(created), 1)
        mock_notify_household.assert_called_once()
        self.assertEqual(mock_notify_household.call_args[0][0], self.household.id)

    # --- serializer validation ---

    def test_recurrence_without_due_date_rejected(self):
        self.client.force_authenticate(self.member)
        response = self.client.post("/api/fakras/", {
            "title": "Weekly groceries",
            "recurrence": "weekly",
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("recurrence", response.data)

    def test_recurrence_with_due_date_accepted(self):
        self.client.force_authenticate(self.member)
        response = self.client.post("/api/fakras/", {
            "title": "Weekly groceries",
            "recurrence": "weekly",
            "due_date": (timezone.now() + timedelta(days=1)).isoformat(),
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["recurrence"], "weekly")
        self.assertIsNone(response.data["recurrence_parent"])


class ItemAttachmentTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@test.com", password="pass1234")
        self.member = User.objects.create_user(email="member@test.com", password="pass1234")
        self.outsider = User.objects.create_user(email="outsider@test.com", password="pass1234")

        self.household = Household.objects.create(name="Family", owner=self.owner)
        Membership.objects.create(user=self.owner, household=self.household, role="owner")
        Membership.objects.create(user=self.member, household=self.household, role="member")

        self.fakra = Fakra.objects.create(title="Weekly groceries", household=self.household, created_by=self.owner)
        self.item = Item.objects.create(fakra=self.fakra, name="Bread", created_by=self.member)

    def tearDown(self):
        for attachment in ItemAttachment.objects.all():
            attachment.file.delete(save=False)

    def _url(self, item=None, attachment=None):
        item = item or self.item
        base = f"/api/fakras/{self.fakra.id}/items/{item.id}/attachments/"
        if attachment is not None:
            return f"{base}{attachment.id}/"
        return base

    def test_member_can_upload_and_list_attachment(self):
        self.client.force_authenticate(self.member)
        response = self.client.post(self._url(), {"file": make_image_file()})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["file"])
        self.assertEqual(response.data["uploaded_by"], self.member.id)

        log = ActivityLog.objects.filter(fakra=self.fakra, action_type="attachment_added")
        self.assertTrue(log.exists())

        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        response = self.client.get(f"/api/fakras/{self.fakra.id}/items/")
        item_data = next(i for i in response.data if i["id"] == self.item.id)
        self.assertEqual(len(item_data["attachments"]), 1)

    def test_outsider_cannot_upload_attachment(self):
        self.client.force_authenticate(self.outsider)
        response = self.client.post(self._url(), {"file": make_image_file()})

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_image_file_is_rejected(self):
        self.client.force_authenticate(self.member)
        text_file = SimpleUploadedFile("notes.txt", b"hello", content_type="text/plain")
        response = self.client.post(self._url(), {"file": text_file})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_oversized_file_is_rejected(self):
        self.client.force_authenticate(self.member)
        big_file = SimpleUploadedFile(
            "big.png", b"x" * (MAX_ATTACHMENT_SIZE + 1), content_type="image/png"
        )
        response = self.client.post(self._url(), {"file": big_file})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_uploader_can_delete_own_attachment(self):
        self.client.force_authenticate(self.member)
        upload = self.client.post(self._url(), {"file": make_image_file()})
        attachment = ItemAttachment.objects.get(pk=upload.data["id"])

        response = self.client.delete(self._url(attachment=attachment))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ItemAttachment.objects.filter(pk=attachment.id).exists())

    def test_fakra_creator_can_delete_others_attachment(self):
        self.client.force_authenticate(self.member)
        upload = self.client.post(self._url(), {"file": make_image_file()})
        attachment = ItemAttachment.objects.get(pk=upload.data["id"])

        self.client.force_authenticate(self.owner)
        response = self.client.delete(self._url(attachment=attachment))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_other_member_cannot_delete_attachment(self):
        other_member = User.objects.create_user(email="other@test.com", password="pass1234")
        Membership.objects.create(user=other_member, household=self.household, role="member")

        self.client.force_authenticate(self.member)
        upload = self.client.post(self._url(), {"file": make_image_file()})
        attachment = ItemAttachment.objects.get(pk=upload.data["id"])

        self.client.force_authenticate(other_member)
        response = self.client.delete(self._url(attachment=attachment))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
