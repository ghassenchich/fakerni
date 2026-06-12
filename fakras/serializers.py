from rest_framework import serializers
from .models import Fakra, Item, ActivityLog


class ItemSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(
        source="created_by.email",
        read_only=True
    )

    done_by_email = serializers.EmailField(
        source="done_by.email",
        read_only=True
    )

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
            "status",
            "created_by",
            "created_by_email",
            "done_by",
            "done_by_email",
            "done_at",
            "created_at",
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
        ]

    def validate_name(self, value):
        value = value.strip()

        if len(value) < 1:
            raise serializers.ValidationError(
                "Name is required"
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

    class Meta:
        model = Fakra

        fields = [
            "id",
            "title",
            "description",
            "status",
            "due_date",
            "household",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
            "items",
        ]

        read_only_fields = [
            "status",
            "created_by",
            "created_by_email",
            "created_at",
            "updated_at",
        ]

    def validate_title(self, value):
        value = value.strip()

        if len(value) < 3:
            raise serializers.ValidationError(
                "Title too short"
            )

        return value

    def validate_household(self, value):
        if value is None:
            return value

        user = self.context["request"].user

        if not value.memberships.filter(user=user).exists():
            raise serializers.ValidationError(
                "Not a member of this household"
            )

        return value


class ShareFakraSerializer(serializers.Serializer):
    user_ids = serializers.ListField(child=serializers.IntegerField())
