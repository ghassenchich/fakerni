from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    FakraViewSet,
    ItemListCreateView,
    ItemDetailView,
    ItemDoneView,
    ItemUndoView,
    FakraArchiveView,
    FakraActivityView,
    FakraShareView,
)

router = DefaultRouter()
router.register(r"", FakraViewSet, basename="fakra")

urlpatterns = [
    path(
        "<int:pk>/archive/",
        FakraArchiveView.as_view(),
    ),

    path(
        "<int:pk>/activity/",
        FakraActivityView.as_view(),
    ),

    path(
        "<int:pk>/share/",
        FakraShareView.as_view(),
    ),

    path(
        "<int:fakra_id>/items/",
        ItemListCreateView.as_view(),
    ),

    path(
        "<int:fakra_id>/items/<int:item_id>/",
        ItemDetailView.as_view(),
    ),

    path(
        "<int:fakra_id>/items/<int:item_id>/done/",
        ItemDoneView.as_view(),
    ),

    path(
        "<int:fakra_id>/items/<int:item_id>/undo/",
        ItemUndoView.as_view(),
    ),

    path("", include(router.urls)),
]
