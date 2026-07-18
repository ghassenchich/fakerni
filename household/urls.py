from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    HouseholdViewSet,
    JoinHouseholdView,
    UpdateMemberRoleView,
    RegenerateInviteView,
    HouseholdMembersView,
    HouseholdMemberDetailView,
    HouseholdBalancesView,
)

router = DefaultRouter()
router.register("households", HouseholdViewSet, basename="household")

urlpatterns = [
    path("", include(router.urls)),

    path(
        "join/",
        JoinHouseholdView.as_view(),
    ),

    path(
        "members/<int:pk>/role/",
        UpdateMemberRoleView.as_view(),
    ),

    path(
        "<int:pk>/regenerate-invite/",
        RegenerateInviteView.as_view(),
    ),

    path(
        "<int:pk>/members/",
        HouseholdMembersView.as_view(),
    ),

    path(
        "<int:pk>/balances/",
        HouseholdBalancesView.as_view(),
    ),

    path(
        "<int:pk>/members/<int:user_id>/",
        HouseholdMemberDetailView.as_view(),
    ),
]