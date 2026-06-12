from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import Membership


class HouseholdConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.household_id = self.scope["url_route"]["kwargs"]["household_id"]
        user = self.scope["user"]

        if not user.is_authenticated or not await self.is_member(user):
            await self.close()
            return

        self.group_name = f"household_{self.household_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    @database_sync_to_async
    def is_member(self, user):
        return Membership.objects.filter(user=user, household_id=self.household_id).exists()

    async def broadcast_event(self, event):
        await self.send_json({
            "event": event["event"],
            "payload": event["payload"],
        })
