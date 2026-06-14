from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase

from channels.testing import WebsocketCommunicator
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from fakerni.asgi import application
from .models import Fakra, FakraAccess

User = get_user_model()


class FakraRealtimeTests(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@test.com", password="pass1234")
        self.shared_user = User.objects.create_user(email="shared@test.com", password="pass1234")
        self.outsider = User.objects.create_user(email="outsider@test.com", password="pass1234")

        self.fakra = Fakra.objects.create(title="Groceries", created_by=self.owner)
        FakraAccess.objects.create(fakra=self.fakra, user=self.shared_user)

    def ws_url(self, user=None):
        url = f"/ws/fakras/{self.fakra.id}/"

        if user:
            token = AccessToken.for_user(user)
            url += f"?token={token}"

        return url

    async def test_owner_can_connect(self):
        communicator = WebsocketCommunicator(application, self.ws_url(self.owner))
        connected, _ = await communicator.connect()

        self.assertTrue(connected)
        await communicator.disconnect()

    async def test_shared_user_can_connect(self):
        communicator = WebsocketCommunicator(application, self.ws_url(self.shared_user))
        connected, _ = await communicator.connect()

        self.assertTrue(connected)
        await communicator.disconnect()

    async def test_outsider_rejected(self):
        communicator = WebsocketCommunicator(application, self.ws_url(self.outsider))
        connected, _ = await communicator.connect()

        self.assertFalse(connected)

    async def test_no_token_rejected(self):
        communicator = WebsocketCommunicator(application, self.ws_url())
        connected, _ = await communicator.connect()

        self.assertFalse(connected)

    async def test_item_created_event_is_broadcast(self):
        communicator = WebsocketCommunicator(application, self.ws_url(self.owner))
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await sync_to_async(self._create_item)(self.owner)

        response = await communicator.receive_json_from(timeout=5)
        self.assertEqual(response["event"], "item.created")
        self.assertEqual(response["payload"]["fakra_id"], self.fakra.id)
        self.assertEqual(response["payload"]["item"]["name"], "Milk")

        await communicator.disconnect()

    def _create_item(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client.post(f"/api/fakras/{self.fakra.id}/items/", {"name": "Milk", "quantity": 1})
