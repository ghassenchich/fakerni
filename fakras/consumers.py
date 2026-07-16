from collections import defaultdict

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import Fakra
from .permissions import user_can_access_fakra


# In-process presence registry: fakra_id -> {channel_name: {"id", "name", "email"}}.
# Tracks who is currently viewing each Fakra. Single-process (in-memory channel
# layer) is sufficient for presence; a multi-process deployment would move this
# to Redis, like the channel layer itself.
_presence = defaultdict(dict)


class FakraConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.fakra_id = self.scope["url_route"]["kwargs"]["fakra_id"]
        user = self.scope["user"]

        if not user.is_authenticated or not await self.has_access(user):
            await self.close()
            return

        self.group_name = f"fakra_{self.fakra_id}"
        self.user_info = {
            "id": user.id,
            "name": getattr(user, "name", "") or "",
            "email": user.email,
        }
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        _presence[self.fakra_id][self.channel_name] = self.user_info
        await self._broadcast_presence()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            _presence.get(self.fakra_id, {}).pop(self.channel_name, None)
            await self._broadcast_presence()
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    @database_sync_to_async
    def has_access(self, user):
        try:
            fakra = Fakra.objects.get(pk=self.fakra_id)
        except Fakra.DoesNotExist:
            return False

        return user_can_access_fakra(user, fakra)

    async def _broadcast_presence(self):
        await self.channel_layer.group_send(self.group_name, {"type": "presence_update"})

    async def presence_update(self, event):
        # De-duplicate by user id (a user may have several tabs/devices open).
        users = {}
        for info in _presence.get(self.fakra_id, {}).values():
            users[info["id"]] = info
        await self.send_json({
            "event": "presence",
            "payload": {"users": list(users.values())},
        })

    async def broadcast_event(self, event):
        await self.send_json({
            "event": event["event"],
            "payload": event["payload"],
        })
