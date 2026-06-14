from django.urls import path

from fakras.consumers import FakraConsumer
from household.consumers import HouseholdConsumer
from users.consumers import UserConsumer

websocket_urlpatterns = [
    path("ws/households/<int:household_id>/", HouseholdConsumer.as_asgi()),
    path("ws/fakras/<int:fakra_id>/", FakraConsumer.as_asgi()),
    path("ws/notifications/", UserConsumer.as_asgi()),
]
