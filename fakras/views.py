from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import CharField, F, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncMonth
from django.shortcuts import get_object_or_404
from django.utils import timezone

from drf_spectacular.utils import extend_schema

from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .ai import (
    AIError,
    interpret_item_commands,
    parse_items_from_image,
    parse_items_from_text,
    suggest_items_for_fakra,
)
from .models import Fakra, Item, ItemAttachment, FakraAccess
from .serializers import (
    FakraSerializer,
    ItemSerializer,
    AttachmentSerializer,
    ActivityLogSerializer,
    ShareFakraSerializer,
)
from .notifications import notify_fakra_access
from .permissions import require_fakra_access
from .realtime import broadcast_to_fakra
from .services import log_activity, mark_item_done, undo_item

from household.notifications import notify_household
from household.permissions import require_role, get_role
from household.realtime import broadcast_to_household
from users.realtime import broadcast_to_user


def _visible_fakras(user):
    return Fakra.objects.filter(
        Q(household__memberships__user=user) |
        Q(created_by=user, household__isnull=True) |
        Q(access__user=user)
    ).distinct()


class FakraViewSet(viewsets.ModelViewSet):
    serializer_class = FakraSerializer
    permission_classes = [IsAuthenticated]

    filterset_fields = ["status", "household"]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "updated_at", "due_date"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Fakra.objects.none()

        return _visible_fakras(self.request.user)

    def perform_create(self, serializer):
        household = serializer.validated_data.get("household")

        if household:
            require_role(
                self.request.user,
                household,
                ["owner", "admin"]
            )

        fakra = serializer.save(created_by=self.request.user)

        if household:
            broadcast_to_household(household.id, "fakra.created", {
                "fakra": FakraSerializer(fakra, context=self.get_serializer_context()).data,
                "household_id": household.id,
            })

            notify_household(
                household.id,
                "New Fakra",
                f"{self.request.user.email} created '{fakra.title}'",
                {"event": "fakra.created", "fakra_id": fakra.id, "household_id": household.id},
                exclude_user_id=self.request.user.id,
            )

            for membership in household.memberships.exclude(user=self.request.user):
                broadcast_to_user(membership.user_id, "fakra.created", {
                    "fakra": FakraSerializer(fakra, context=self.get_serializer_context()).data,
                    "household_id": household.id,
                })


def _create_item_and_notify(fakra, user, data):
    serializer = ItemSerializer(data=data)
    serializer.is_valid(raise_exception=True)
    item = serializer.save(fakra=fakra, created_by=user)

    log_activity(
        fakra,
        user,
        "item_added",
        f"{user.email} added '{item.name}'"
    )

    broadcast_to_fakra(fakra.id, "item.created", {
        "item": ItemSerializer(item).data,
        "fakra_id": fakra.id,
    })

    notify_fakra_access(
        fakra,
        "New item added",
        f"{user.email} added '{item.name}' to '{fakra.title}'",
        {"event": "item.created", "fakra_id": fakra.id, "item_id": item.id},
        exclude_user_id=user.id,
    )

    if fakra.household_id:
        broadcast_to_household(fakra.household_id, "item.created", {
            "item": ItemSerializer(item).data,
            "fakra_id": fakra.id,
        })

        notify_household(
            fakra.household_id,
            "New item added",
            f"{user.email} added '{item.name}' to '{fakra.title}'",
            {"event": "item.created", "fakra_id": fakra.id, "item_id": item.id},
            exclude_user_id=user.id,
        )

    return item


def _check_budget_alert(fakra):
    items = list(fakra.items.all())
    total = sum((i.estimated_price or 0) * i.quantity for i in items)
    spent = sum(
        (i.estimated_price or 0) * i.quantity for i in items if i.status == "done"
    )

    if total > 0 and spent >= total and not fakra.budget_alert_sent:
        fakra.budget_alert_sent = True
        fakra.save(update_fields=["budget_alert_sent"])

        title = "Budget reached"
        body = f"'{fakra.title}' has reached its estimated budget of {total}"
        data = {"event": "fakra.budget_alert", "fakra_id": fakra.id}

        notify_fakra_access(fakra, title, body, data)

        if fakra.household_id:
            notify_household(fakra.household_id, title, body, data)

    elif total > 0 and spent < total and fakra.budget_alert_sent:
        fakra.budget_alert_sent = False
        fakra.save(update_fields=["budget_alert_sent"])


def _mark_item_done_and_notify(item, user):
    mark_item_done(item, user)

    log_activity(
        item.fakra,
        user,
        "item_done",
        f"{user.email} marked '{item.name}' as done"
    )

    broadcast_to_fakra(item.fakra_id, "item.done", {
        "item_id": item.id,
        "fakra_id": item.fakra_id,
        "done_by_user": user.id,
        "done_at": item.done_at.isoformat(),
    })

    notify_fakra_access(
        item.fakra,
        "Item done",
        f"{user.email} marked '{item.name}' as done",
        {"event": "item.done", "fakra_id": item.fakra_id, "item_id": item.id},
        exclude_user_id=user.id,
    )

    if item.fakra.household_id:
        broadcast_to_household(item.fakra.household_id, "item.done", {
            "item_id": item.id,
            "fakra_id": item.fakra_id,
            "done_by_user": user.id,
            "done_at": item.done_at.isoformat(),
        })

        notify_household(
            item.fakra.household_id,
            "Item done",
            f"{user.email} marked '{item.name}' as done",
            {"event": "item.done", "fakra_id": item.fakra_id, "item_id": item.id},
            exclude_user_id=user.id,
        )

    _check_budget_alert(item.fakra)

    return item


def _undo_item_and_notify(item, user):
    undo_item(item)

    log_activity(
        item.fakra,
        user,
        "item_undone",
        f"{user.email} reverted '{item.name}' to pending"
    )

    broadcast_to_fakra(item.fakra_id, "item.undo", {
        "item_id": item.id,
        "fakra_id": item.fakra_id,
        "reverted_by_user": user.id,
    })

    notify_fakra_access(
        item.fakra,
        "Item reverted",
        f"{user.email} reverted '{item.name}' to pending",
        {"event": "item.undo", "fakra_id": item.fakra_id, "item_id": item.id},
        exclude_user_id=user.id,
    )

    if item.fakra.household_id:
        broadcast_to_household(item.fakra.household_id, "item.undo", {
            "item_id": item.id,
            "fakra_id": item.fakra_id,
            "reverted_by_user": user.id,
        })

        notify_household(
            item.fakra.household_id,
            "Item reverted",
            f"{user.email} reverted '{item.name}' to pending",
            {"event": "item.undo", "fakra_id": item.fakra_id, "item_id": item.id},
            exclude_user_id=user.id,
        )

    _check_budget_alert(item.fakra)

    return item


def _delete_item_and_notify(item, user):
    fakra = item.fakra
    item_id = item.id
    item_name = item.name

    item.delete()

    log_activity(
        fakra,
        user,
        "item_deleted",
        f"{user.email} removed '{item_name}'"
    )

    broadcast_to_fakra(fakra.id, "item.deleted", {
        "item_id": item_id,
        "fakra_id": fakra.id,
    })

    notify_fakra_access(
        fakra,
        "Item removed",
        f"{user.email} removed '{item_name}'",
        {"event": "item.deleted", "fakra_id": fakra.id, "item_id": item_id},
        exclude_user_id=user.id,
    )

    if fakra.household_id:
        broadcast_to_household(fakra.household_id, "item.deleted", {
            "item_id": item_id,
            "fakra_id": fakra.id,
        })

        notify_household(
            fakra.household_id,
            "Item removed",
            f"{user.email} removed '{item_name}'",
            {"event": "item.deleted", "fakra_id": fakra.id, "item_id": item_id},
            exclude_user_id=user.id,
        )

    _check_budget_alert(fakra)


class ItemListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ItemSerializer

    def get(self, request, fakra_id):
        fakra = get_object_or_404(Fakra, pk=fakra_id)
        require_fakra_access(request.user, fakra)

        items = fakra.items.all()

        status_param = request.query_params.get("status")
        if status_param:
            items = items.filter(status=status_param)

        category = request.query_params.get("category")
        if category:
            items = items.filter(category=category)

        search = request.query_params.get("search")
        if search:
            items = items.filter(
                Q(name__icontains=search) | Q(notes__icontains=search)
            )

        ordering = request.query_params.get("ordering")
        if ordering in ["created_at", "-created_at", "name", "-name"]:
            items = items.order_by(ordering)

        serializer = ItemSerializer(items, many=True)
        return Response(serializer.data)

    def post(self, request, fakra_id):
        fakra = get_object_or_404(Fakra, pk=fakra_id)
        require_fakra_access(request.user, fakra)

        item = _create_item_and_notify(fakra, request.user, request.data)

        return Response(
            ItemSerializer(item).data,
            status=status.HTTP_201_CREATED
        )


class ItemSmartAddView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, fakra_id):
        fakra = get_object_or_404(Fakra, pk=fakra_id)
        require_fakra_access(request.user, fakra)

        text = request.data.get("text", "").strip()
        if not text:
            raise ValidationError({"text": "This field is required."})

        try:
            parsed_items = parse_items_from_text(text)
        except AIError as exc:
            raise ValidationError({"text": str(exc)})

        items = [
            _create_item_and_notify(fakra, request.user, parsed_item.model_dump())
            for parsed_item in parsed_items
        ]

        return Response(
            ItemSerializer(items, many=True).data,
            status=status.HTTP_201_CREATED
        )


class ItemSmartScanView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, fakra_id):
        fakra = get_object_or_404(Fakra, pk=fakra_id)
        require_fakra_access(request.user, fakra)

        image = request.data.get("image")
        if not image:
            raise ValidationError({"image": "This field is required."})

        if not image.content_type.startswith("image/"):
            raise ValidationError({"image": "Only image files are allowed."})

        if image.size > MAX_ATTACHMENT_SIZE:
            raise ValidationError({"image": "File too large (max 5MB)."})

        try:
            parsed_items = parse_items_from_image(image.read(), image.content_type)
        except AIError as exc:
            raise ValidationError({"image": str(exc)})

        items = [
            _create_item_and_notify(fakra, request.user, parsed_item.model_dump())
            for parsed_item in parsed_items
        ]

        return Response(
            ItemSerializer(items, many=True).data,
            status=status.HTTP_201_CREATED
        )


class ItemSuggestionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, fakra_id):
        fakra = get_object_or_404(Fakra, pk=fakra_id)
        require_fakra_access(request.user, fakra)

        existing_item_names = list(fakra.items.values_list("name", flat=True))

        try:
            suggestions = suggest_items_for_fakra(
                fakra.title, fakra.description, existing_item_names
            )
        except AIError as exc:
            raise ValidationError({"detail": str(exc)})

        return Response([s.model_dump() for s in suggestions])


class ItemSmartCommandView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, fakra_id):
        fakra = get_object_or_404(Fakra, pk=fakra_id)
        require_fakra_access(request.user, fakra)

        text = request.data.get("text", "").strip()
        if not text:
            raise ValidationError({"text": "This field is required."})

        items = list(fakra.items.all())
        items_by_id = {item.id: item for item in items}

        try:
            commands = interpret_item_commands(text, items)
        except AIError as exc:
            raise ValidationError({"text": str(exc)})

        results = []

        for command in commands:
            item = items_by_id.get(command.item_id)
            item_id = command.item_id

            if item is None:
                results.append({
                    "item_id": command.item_id,
                    "action": command.action,
                    "applied": False,
                    "reason": "Item not found",
                })
                continue

            if command.action == "done":
                if item.status == "done":
                    results.append({
                        "item_id": item_id,
                        "action": command.action,
                        "applied": False,
                        "reason": "Item is already done",
                    })
                    continue

                _mark_item_done_and_notify(item, request.user)
                item_data = ItemSerializer(item).data

            elif command.action == "undo":
                if item.status != "done" or item.done_at is None:
                    results.append({
                        "item_id": item_id,
                        "action": command.action,
                        "applied": False,
                        "reason": "Item is not marked as done",
                    })
                    continue

                if timezone.now() - item.done_at > timedelta(minutes=10):
                    results.append({
                        "item_id": item_id,
                        "action": command.action,
                        "applied": False,
                        "reason": "Undo window has expired",
                    })
                    continue

                _undo_item_and_notify(item, request.user)
                item_data = ItemSerializer(item).data

            elif command.action == "delete":
                if item.created_by != request.user and fakra.created_by != request.user:
                    results.append({
                        "item_id": item_id,
                        "action": command.action,
                        "applied": False,
                        "reason": "Not allowed to delete this item",
                    })
                    continue

                _delete_item_and_notify(item, request.user)
                item_data = None

            results.append({
                "item_id": item_id,
                "action": command.action,
                "applied": True,
                "item": item_data,
            })

        return Response({"results": results})


class ItemDetailView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ItemSerializer

    def get_item(self, fakra_id, item_id):
        return get_object_or_404(Item, pk=item_id, fakra_id=fakra_id)

    def check_edit_permission(self, request, item):
        require_fakra_access(request.user, item.fakra)

        if item.created_by != request.user and item.fakra.created_by != request.user:
            raise PermissionDenied(
                "Only the item creator or the Fakra creator can edit or delete this item"
            )

    def patch(self, request, fakra_id, item_id):
        item = self.get_item(fakra_id, item_id)
        self.check_edit_permission(request, item)

        serializer = ItemSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)

    @extend_schema(responses={204: None})
    def delete(self, request, fakra_id, item_id):
        item = self.get_item(fakra_id, item_id)
        self.check_edit_permission(request, item)

        _delete_item_and_notify(item, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ItemDoneView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ItemSerializer

    @extend_schema(request=None, responses=ItemSerializer)
    def post(self, request, fakra_id, item_id):
        item = get_object_or_404(Item, pk=item_id, fakra_id=fakra_id)
        require_fakra_access(request.user, item.fakra)

        if item.status == "done":
            return Response(
                {"error": "Item is already done"},
                status=status.HTTP_400_BAD_REQUEST
            )

        _mark_item_done_and_notify(item, request.user)

        return Response(ItemSerializer(item).data)


class ItemUndoView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ItemSerializer

    @extend_schema(request=None, responses=ItemSerializer)
    def post(self, request, fakra_id, item_id):
        item = get_object_or_404(Item, pk=item_id, fakra_id=fakra_id)
        require_fakra_access(request.user, item.fakra)

        if item.status != "done" or item.done_at is None:
            return Response(
                {"error": "Item is not marked as done"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if timezone.now() - item.done_at > timedelta(minutes=10):
            return Response(
                {"error": "Undo window has expired"},
                status=status.HTTP_400_BAD_REQUEST
            )

        _undo_item_and_notify(item, request.user)

        return Response(ItemSerializer(item).data)


MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024


class ItemAttachmentListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AttachmentSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_item(self, fakra_id, item_id):
        return get_object_or_404(Item, pk=item_id, fakra_id=fakra_id)

    def get(self, request, fakra_id, item_id):
        item = self.get_item(fakra_id, item_id)
        require_fakra_access(request.user, item.fakra)

        serializer = AttachmentSerializer(
            item.attachments.all(), many=True, context={"request": request}
        )
        return Response(serializer.data)

    def post(self, request, fakra_id, item_id):
        item = self.get_item(fakra_id, item_id)
        require_fakra_access(request.user, item.fakra)

        file = request.data.get("file")
        if not file:
            return Response(
                {"error": "No file provided"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not file.content_type.startswith("image/"):
            return Response(
                {"error": "Only image files are allowed"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if file.size > MAX_ATTACHMENT_SIZE:
            return Response(
                {"error": "File too large (max 5MB)"},
                status=status.HTTP_400_BAD_REQUEST
            )

        attachment = ItemAttachment.objects.create(
            item=item, file=file, uploaded_by=request.user
        )

        log_activity(
            item.fakra,
            request.user,
            "attachment_added",
            f"{request.user.email} added a photo to '{item.name}'"
        )

        serializer = AttachmentSerializer(attachment, context={"request": request})

        broadcast_to_fakra(item.fakra_id, "attachment.created", {
            "attachment": serializer.data,
            "item_id": item.id,
            "fakra_id": item.fakra_id,
        })

        notify_fakra_access(
            item.fakra,
            "New attachment",
            f"{request.user.email} added a photo to '{item.name}'",
            {"event": "attachment.created", "fakra_id": item.fakra_id, "item_id": item.id},
            exclude_user_id=request.user.id,
        )

        if item.fakra.household_id:
            broadcast_to_household(item.fakra.household_id, "attachment.created", {
                "attachment": serializer.data,
                "item_id": item.id,
                "fakra_id": item.fakra_id,
            })

            notify_household(
                item.fakra.household_id,
                "New attachment",
                f"{request.user.email} added a photo to '{item.name}'",
                {"event": "attachment.created", "fakra_id": item.fakra_id, "item_id": item.id},
                exclude_user_id=request.user.id,
            )

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ItemAttachmentDetailView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AttachmentSerializer

    @extend_schema(responses={204: None})
    def delete(self, request, fakra_id, item_id, attachment_id):
        attachment = get_object_or_404(
            ItemAttachment, pk=attachment_id, item_id=item_id, item__fakra_id=fakra_id
        )
        item = attachment.item
        require_fakra_access(request.user, item.fakra)

        if attachment.uploaded_by != request.user and item.fakra.created_by != request.user:
            raise PermissionDenied(
                "Only the uploader or the Fakra creator can delete this attachment"
            )

        attachment.file.delete(save=False)
        attachment.delete()

        log_activity(
            item.fakra,
            request.user,
            "attachment_removed",
            f"{request.user.email} removed a photo from '{item.name}'"
        )

        broadcast_to_fakra(item.fakra_id, "attachment.deleted", {
            "attachment_id": attachment_id,
            "item_id": item.id,
            "fakra_id": item.fakra_id,
        })

        notify_fakra_access(
            item.fakra,
            "Attachment removed",
            f"{request.user.email} removed a photo from '{item.name}'",
            {"event": "attachment.deleted", "fakra_id": item.fakra_id, "item_id": item.id},
            exclude_user_id=request.user.id,
        )

        if item.fakra.household_id:
            broadcast_to_household(item.fakra.household_id, "attachment.deleted", {
                "attachment_id": attachment_id,
                "item_id": item.id,
                "fakra_id": item.fakra_id,
            })

        return Response(status=status.HTTP_204_NO_CONTENT)


class FakraArchiveView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FakraSerializer

    @extend_schema(request=None, responses=FakraSerializer)
    def post(self, request, pk):
        fakra = get_object_or_404(Fakra, pk=pk)
        require_fakra_access(request.user, fakra)

        is_household_admin = (
            fakra.household_id and
            get_role(request.user, fakra.household) in ["owner", "admin"]
        )

        if fakra.created_by != request.user and not is_household_admin:
            raise PermissionDenied(
                "Only the creator or a household owner/admin can archive this Fakra"
            )

        fakra.status = "archived"
        fakra.save()

        log_activity(
            fakra,
            request.user,
            "fakra_archived",
            f"{request.user.email} archived '{fakra.title}'"
        )

        return Response(FakraSerializer(fakra, context={"request": request}).data)


class FakraActivityView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ActivityLogSerializer

    def get(self, request, pk):
        fakra = get_object_or_404(Fakra, pk=pk)
        require_fakra_access(request.user, fakra)

        serializer = ActivityLogSerializer(fakra.activity_logs.all(), many=True)
        return Response(serializer.data)


class FakraShareView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ShareFakraSerializer

    @extend_schema(request=ShareFakraSerializer, responses=FakraSerializer)
    def post(self, request, pk):
        fakra = get_object_or_404(Fakra, pk=pk)

        is_household_admin = (
            fakra.household_id and
            get_role(request.user, fakra.household) in ["owner", "admin"]
        )

        if fakra.created_by != request.user and not is_household_admin:
            raise PermissionDenied(
                "Only the creator or a household owner/admin can share this Fakra"
            )

        user_ids = request.data.get("user_ids", [])
        users = get_user_model().objects.filter(id__in=user_ids)

        for user in users:
            _, created = FakraAccess.objects.get_or_create(fakra=fakra, user=user)

            if created:
                broadcast_to_user(user.id, "fakra.shared", {
                    "fakra": FakraSerializer(fakra, context={"request": request}).data,
                })

        return Response(FakraSerializer(fakra, context={"request": request}).data)


class SpendingAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        fakras = _visible_fakras(request.user)

        done_items = Item.objects.filter(
            fakra__in=fakras, status="done", estimated_price__isnull=False
        ).annotate(cost=F("estimated_price") * F("quantity"))

        total_spent = done_items.aggregate(total=Sum("cost"))["total"] or 0

        month_start = timezone.now().replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        spent_this_month = done_items.filter(
            done_at__gte=month_start
        ).aggregate(total=Sum("cost"))["total"] or 0

        by_month = [
            {"month": entry["month"].strftime("%Y-%m"), "total": entry["total"]}
            for entry in (
                done_items
                .annotate(month=TruncMonth("done_at"))
                .values("month")
                .annotate(total=Sum("cost"))
                .order_by("month")
            )
        ]

        by_category = [
            {"category": entry["category_label"], "total": entry["total"]}
            for entry in (
                done_items
                .annotate(category_label=Coalesce(
                    "category", Value("Uncategorized"), output_field=CharField()
                ))
                .values("category_label")
                .annotate(total=Sum("cost"))
                .order_by("-total")
            )
        ]

        by_fakra = [
            {"fakra_id": entry["fakra_id"], "title": entry["fakra__title"], "total": entry["total"]}
            for entry in (
                done_items
                .values("fakra_id", "fakra__title")
                .annotate(total=Sum("cost"))
                .order_by("-total")[:5]
            )
        ]

        pending_items = Item.objects.filter(
            fakra__in=fakras, status="pending", estimated_price__isnull=False
        ).annotate(cost=F("estimated_price") * F("quantity"))
        budget_remaining = pending_items.aggregate(total=Sum("cost"))["total"] or 0

        return Response({
            "total_spent": total_spent,
            "spent_this_month": spent_this_month,
            "budget_remaining": budget_remaining,
            "by_month": by_month,
            "by_category": by_category,
            "by_fakra": by_fakra,
        })


class CategorySuggestionsView(APIView):
    def get(self, request):
        categories = (
            Item.objects.filter(fakra__in=_visible_fakras(request.user))
            .exclude(category__isnull=True)
            .exclude(category="")
            .values_list("category", flat=True)
            .distinct()
            .order_by("category")
        )
        return Response(sorted(set(categories)))
