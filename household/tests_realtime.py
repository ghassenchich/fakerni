from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase

from channels.testing import WebsocketCommunicator
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from fakerni.asgi import application
from .models import Household, Membership

User = get_user_model()


class HouseholdRealtimeTests(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@test.com", password="pass1234")
        self.member = User.objects.create_user(email="member@test.com", password="pass1234")
        self.outsider = User.objects.create_user(email="outsider@test.com", password="pass1234")

        self.household = Household.objects.create(name="Family", owner=self.owner)
        Membership.objects.create(user=self.owner, household=self.household, role="owner")

    def ws_url(self, user=None):
        url = f"/ws/households/{self.household.id}/"

        if user:
            token = AccessToken.for_user(user)
            url += f"?token={token}"

        return url

    async def test_member_can_connect(self):
        communicator = WebsocketCommunicator(application, self.ws_url(self.owner))
        connected, _ = await communicator.connect()

        self.assertTrue(connected)
        await communicator.disconnect()

    async def test_non_member_rejected(self):
        communicator = WebsocketCommunicator(application, self.ws_url(self.outsider))
        connected, _ = await communicator.connect()

        self.assertFalse(connected)

    async def test_no_token_rejected(self):
        communicator = WebsocketCommunicator(application, self.ws_url())
        connected, _ = await communicator.connect()

        self.assertFalse(connected)

    async def test_member_joined_event_is_broadcast(self):
        communicator = WebsocketCommunicator(application, self.ws_url(self.owner))
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await sync_to_async(self._join_via_invite_code)(self.member)

        response = await communicator.receive_json_from(timeout=5)
        self.assertEqual(response["event"], "member.joined")
        self.assertEqual(response["payload"]["user_id"], self.member.id)

        await communicator.disconnect()

    def _join_via_invite_code(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client.post("/api/household/join/", {"invite_code": self.household.invite_code})
