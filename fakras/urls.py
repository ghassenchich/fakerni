from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    FakraViewSet,
    ItemListCreateView,
    ItemSmartAddView,
    ItemSmartScanView,
    ItemSmartCommandView,
    ItemSuggestionsView,
    ItemDetailView,
    ItemDoneView,
    ItemUndoView,
    ItemAttachmentListCreateView,
    ItemAttachmentDetailView,
    FakraArchiveView,
    FakraDuplicateView,
    FakraExportPdfView,
    FakraActivityView,
    FakraShareView,
    SpendingAnalyticsView,
    RestockSuggestionsView,
    CategorySuggestionsView,
)

router = DefaultRouter()
router.register(r"", FakraViewSet, basename="fakra")

urlpatterns = [
    path(
        "analytics/spending/",
        SpendingAnalyticsView.as_view(),
    ),

    path(
        "restock-suggestions/",
        RestockSuggestionsView.as_view(),
    ),

    path(
        "categories/",
        CategorySuggestionsView.as_view(),
    ),

    path(
        "<int:pk>/archive/",
        FakraArchiveView.as_view(),
    ),

    path(
        "<int:pk>/duplicate/",
        FakraDuplicateView.as_view(),
    ),

    path(
        "<int:pk>/export/pdf/",
        FakraExportPdfView.as_view(),
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
        "<int:fakra_id>/items/smart-add/",
        ItemSmartAddView.as_view(),
    ),

    path(
        "<int:fakra_id>/items/smart-scan/",
        ItemSmartScanView.as_view(),
    ),

    path(
        "<int:fakra_id>/items/smart-command/",
        ItemSmartCommandView.as_view(),
    ),

    path(
        "<int:fakra_id>/items/suggestions/",
        ItemSuggestionsView.as_view(),
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

    path(
        "<int:fakra_id>/items/<int:item_id>/attachments/",
        ItemAttachmentListCreateView.as_view(),
    ),

    path(
        "<int:fakra_id>/items/<int:item_id>/attachments/<int:attachment_id>/",
        ItemAttachmentDetailView.as_view(),
    ),

    path("", include(router.urls)),
]
