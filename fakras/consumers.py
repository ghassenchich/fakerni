from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import Fakra
from .permissions import user_can_access_fakra


class FakraConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.fakra_id = self.scope["url_route"]["kwargs"]["fakra_id"]
        user = self.scope["user"]

        if not user.is_authenticated or not await self.has_access(user):
            await self.close()
            return

        self.group_name = f"fakra_{self.fakra_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    @database_sync_to_async
    def has_access(self, user):
        try:
            fakra = Fakra.objects.get(pk=self.fakra_id)
        except Fakra.DoesNotExist:
            return False

        return user_can_access_fakra(user, fakra)

    async def broadcast_event(self, event):
        await self.send_json({
            "event": event["event"],
            "payload": event["payload"],
        })
