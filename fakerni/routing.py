from django.urls import path

from household.consumers import HouseholdConsumer

websocket_urlpatterns = [
    path("ws/households/<int:household_id>/", HouseholdConsumer.as_asgi()),
]
