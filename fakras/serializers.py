from rest_framework import serializers
from .models import Fakra, Item, ItemAttachment, ActivityLog


class AttachmentSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()

    uploaded_by_email = serializers.EmailField(
        source="uploaded_by.email",
        read_only=True
    )

    class Meta:
        model = ItemAttachment

        fields = [
            "id",
            "item",
            "file",
            "uploaded_by",
            "uploaded_by_email",
            "created_at",
        ]

        read_only_fields = [
            "item",
            "uploaded_by",
            "uploaded_by_email",
            "created_at",
        ]

    def get_file(self, obj):
        request = self.context.get("request")
        if request is not None:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url


class ItemSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(
        source="created_by.email",
        read_only=True
    )

    done_by_email = serializers.EmailField(
        source="done_by.email",
        read_only=True
    )

    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Item

        fields = [
            "id",
            "fakra",
            "name",
            "quantity",
            "unit",
            "category",
            "notes",
            "estimated_price",
            "status",
            "created_by",
            "created_by_email",
            "done_by",
            "done_by_email",
            "done_at",
            "created_at",
            "attachments",
        ]

        read_only_fields = [
            "fakra",
            "status",
            "created_by",
            "created_by_email",
            "done_by",
            "done_by_email",
            "done_at",
            "created_at",
            "attachments",
        ]

    def validate_name(self, value):
        value = value.strip()

        if len(value) < 1:
            raise serializers.ValidationError(
                "Name is required"
            )

        return value

    def validate_estimated_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError(
                "Estimated price cannot be negative"
            )

        return value


class ActivityLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(
        source="actor.email",
        read_only=True
    )

    class Meta:
        model = ActivityLog

        fields = [
            "id",
            "actor",
            "actor_email",
            "action_type",
            "description",
            "created_at",
        ]

        read_only_fields = fields


class FakraSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(
        source="created_by.email",
        read_only=True
    )

    items = ItemSerializer(many=True, read_only=True)

    estimated_total = serializers.SerializerMethodField()
    estimated_remaining = serializers.SerializerMethodField()

    class Meta:
        model = Fakra

        fields = [
            "id",
            "title",
            "description",
            "status",
            "due_date",
            "recurrence",
            "recurrence_parent",
            "household",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
            "items",
            "estimated_total",
            "estimated_remaining",
        ]

        read_only_fields = [
            "status",
            "recurrence_parent",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        ]

    def get_estimated_total(self, obj):
        return sum(
            (item.estimated_price or 0) * item.quantity for item in obj.items.all()
        )

    def get_estimated_remaining(self, obj):
        return sum(
            (item.estimated_price or 0) * item.quantity
            for item in obj.items.all()
            if item.status != "done"
        )

    def validate_title(self, value):
        value = value.strip()

        if len(value) < 3:
            raise serializers.ValidationError(
                "Title too short"
            )

        return value

    def validate(self, data):
        recurrence = data.get("recurrence", getattr(self.instance, "recurrence", "none"))
        due_date = data.get("due_date", getattr(self.instance, "due_date", None))

        if recurrence != "none" and due_date is None:
            raise serializers.ValidationError(
                {"recurrence": "Recurring Fakras must have a due date."}
            )

        return data

    def validate_household(self, value):
        if value is None:
            return value

        user = self.context["request"].user

        if not value.memberships.filter(user=user).exists():
            raise serializers.ValidationError(
                "Not a member of this household"
            )

        return value

    def update(self, instance, validated_data):
        if "due_date" in validated_data and validated_data["due_date"] != instance.due_date:
            instance.reminder_sent_at = None

        return super().update(instance, validated_data)


class ShareFakraSerializer(serializers.Serializer):
    user_ids = serializers.ListField(child=serializers.IntegerField())
