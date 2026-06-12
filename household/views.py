from datetime import timedelta
import secrets

from django.shortcuts import get_object_or_404
from django.utils import timezone

from drf_spectacular.utils import extend_schema

from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Household, Membership
from .notifications import notify_household
from .permissions import require_role
from .realtime import broadcast_to_household
from .serializers import (
    HouseholdSerializer,
    MembershipSerializer,
    JoinHouseholdSerializer,
    UpdateMemberRoleSerializer,
    InviteCodeResponseSerializer,
)


class HouseholdViewSet(viewsets.ModelViewSet):
    serializer_class = HouseholdSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Household.objects.none()

        return Household.objects.filter(
            memberships__user=self.request.user
        ).distinct()

    def perform_create(self, serializer):
        household = serializer.save(owner=self.request.user)

        Membership.objects.create(
            user=self.request.user,
            household=household,
            role="owner"
        )

    def perform_update(self, serializer):
        household = self.get_object()

        require_role(
            self.request.user,
            household,
            ["owner", "admin"]
        )

        serializer.save()

    def perform_destroy(self, instance):
        require_role(
            self.request.user,
            instance,
            ["owner"]
        )

        instance.delete()


class JoinHouseholdView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = JoinHouseholdSerializer

    def post(self, request):
        code = request.data.get("invite_code")

        household = Household.objects.filter(
            invite_code=code
        ).first()

        if not household:
            return Response(
                {"error": "Invalid invite code"},
                status=status.HTTP_404_NOT_FOUND
            )

        if household.invite_expires_at < timezone.now():
            return Response(
                {"error": "Invite expired"},
                status=status.HTTP_400_BAD_REQUEST
            )

        already_member = Membership.objects.filter(
            user=request.user,
            household=household
        ).exists()

        if already_member:
            return Response(
                {"message": "Already joined"},
                status=status.HTTP_200_OK
            )

        Membership.objects.create(
            user=request.user,
            household=household,
            role="member"
        )

        broadcast_to_household(household.id, "member.joined", {
            "user_id": request.user.id,
            "email": request.user.email,
            "household_id": household.id,
        })

        notify_household(
            household.id,
            "New member joined",
            f"{request.user.email} joined {household.name}",
            {"event": "member.joined", "household_id": household.id},
            exclude_user_id=request.user.id,
        )

        return Response(
            {"message": "Joined successfully"},
            status=status.HTTP_201_CREATED
        )


class UpdateMemberRoleView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UpdateMemberRoleSerializer

    def post(self, request, pk):
        membership = get_object_or_404(Membership, pk=pk)

        household = membership.household

        require_role(
            request.user,
            household,
            ["owner"]
        )

        new_role = request.data.get("role")

        if new_role not in ["owner", "admin", "member"]:
            return Response(
                {"error": "Invalid role"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if membership.user == request.user and new_role != "owner":
            return Response(
                {"error": "Transfer ownership first"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_role == "owner":
            current_owner = household.memberships.get(role="owner")
            current_owner.role = "admin"
            current_owner.save()

        membership.role = new_role
        membership.save()

        return Response({"message": "Role updated"})


class RegenerateInviteView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InviteCodeResponseSerializer

    @extend_schema(request=None, responses=InviteCodeResponseSerializer)
    def post(self, request, pk):
        household = get_object_or_404(Household, pk=pk)

        require_role(
            request.user,
            household,
            ["owner", "admin"]
        )

        household.invite_code = secrets.token_hex(4)
        household.invite_expires_at = timezone.now() + timedelta(hours=24)
        household.save()

        return Response({
            "invite_code": household.invite_code,
            "expires_at": household.invite_expires_at,
        })


class HouseholdMembersView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MembershipSerializer

    def get(self, request, pk):
        household = get_object_or_404(Household, pk=pk)

        require_role(
            request.user,
            household,
            ["owner", "admin", "member"]
        )

        serializer = MembershipSerializer(household.memberships.all(), many=True)
        return Response(serializer.data)


class HouseholdMemberDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={204: None})
    def delete(self, request, pk, user_id):
        household = get_object_or_404(Household, pk=pk)
        membership = get_object_or_404(Membership, household=household, user_id=user_id)

        if user_id == request.user.id:
            if membership.role == "owner":
                return Response(
                    {"error": "Transfer ownership before leaving"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            membership.delete()

            broadcast_to_household(household.id, "member.left", {
                "user_id": user_id,
                "household_id": household.id,
            })

            notify_household(
                household.id,
                "Member left",
                f"{request.user.email} left {household.name}",
                {"event": "member.left", "household_id": household.id},
                exclude_user_id=user_id,
            )

            return Response(status=status.HTTP_204_NO_CONTENT)

        require_role(
            request.user,
            household,
            ["owner", "admin"]
        )

        if membership.role == "owner":
            return Response(
                {"error": "Cannot remove the household owner"},
                status=status.HTTP_400_BAD_REQUEST
            )

        membership.delete()

        broadcast_to_household(household.id, "member.left", {
            "user_id": user_id,
            "household_id": household.id,
        })

        notify_household(
            household.id,
            "Member removed",
            f"A member was removed from {household.name}",
            {"event": "member.left", "household_id": household.id},
            exclude_user_id=user_id,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)