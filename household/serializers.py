from rest_framework import serializers
from .models import Household, Membership


class MembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Membership
        fields = [
            "id",
            "user",
            "user_email",
            "household",
            "role",
            "joined_at",
        ]
        read_only_fields = ["joined_at"]


class HouseholdSerializer(serializers.ModelSerializer):
    memberships = MembershipSerializer(many=True, read_only=True)

    class Meta:
        model = Household
        fields = [
            "id",
            "name",
            "type",
            "owner",
            "invite_code",
            "invite_expires_at",
            "created_at",
            "memberships",
        ]

        read_only_fields = [
            "owner",
            "invite_code",
            "invite_expires_at",
            "created_at",
        ]


class JoinHouseholdSerializer(serializers.Serializer):
    invite_code = serializers.CharField()


class UpdateMemberRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["owner", "admin", "member"])


class InviteCodeResponseSerializer(serializers.Serializer):
    invite_code = serializers.CharField()
    expires_at = serializers.DateTimeField()