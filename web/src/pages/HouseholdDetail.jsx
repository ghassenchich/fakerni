import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, KeyRound, ListChecks, LogOut, RefreshCw, Users, UserX } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as householdsApi from "../api/households";
import * as fakrasApi from "../api/fakras";
import { useHouseholdSocket } from "../hooks/useHouseholdSocket";
import { Badge, Button, Card, ErrorText, IconButton, Select, extractError } from "../components/ui";

const ROLES = ["owner", "admin", "member"];

export default function HouseholdDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [household, setHousehold] = useState(null);
  const [fakras, setFakras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [householdRes, fakrasRes] = await Promise.all([
        householdsApi.getHousehold(id),
        fakrasApi.listFakras({ household: id }),
      ]);
      setHousehold(householdRes.data);
      setFakras(fakrasRes.data.results ?? fakrasRes.data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useHouseholdSocket(id, (message) => {
    if (["member.joined", "member.left", "fakra.created"].includes(message.event)) {
      load();
    }
  });

  const myMembership = household?.memberships?.find((m) => m.user === user?.id);
  const myRole = myMembership?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  async function handleRegenerateInvite() {
    setActionError("");
    try {
      await householdsApi.regenerateInvite(id);
      load();
    } catch (err) {
      setActionError(extractError(err));
    }
  }

  async function handleRoleChange(membershipId, role) {
    setActionError("");
    try {
      await householdsApi.updateMemberRole(membershipId, role);
      load();
    } catch (err) {
      setActionError(extractError(err));
    }
  }

  async function handleRemoveMember(userId) {
    setActionError("");
    try {
      await householdsApi.removeMember(id, userId);
      load();
    } catch (err) {
      setActionError(extractError(err));
    }
  }

  async function handleLeave() {
    setActionError("");
    try {
      await householdsApi.removeMember(id, user.id);
      navigate("/households");
    } catch (err) {
      setActionError(extractError(err));
    }
  }

  if (loading) return <p className="text-sm text-slate-500">{t("common.loading")}</p>;
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!household) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-blue-950">{household.name}</h1>
        {myRole !== "owner" && (
          <Button variant="danger" onClick={handleLeave}>
            <LogOut className="h-4 w-4" />
            {t("householdDetail.leave")}
          </Button>
        )}
      </div>

      <ErrorText>{actionError}</ErrorText>

      {canManage && (
        <Card>
          <h2 className="font-medium mb-2 flex items-center gap-2 text-blue-950">
            <KeyRound className="h-4 w-4 text-blue-700" />
            {t("householdDetail.inviteCode")}
          </h2>
          <div className="flex items-center gap-3">
            <code className="bg-blue-50 text-blue-900 px-2 py-1 rounded text-sm">{household.invite_code}</code>
            {household.invite_expires_at && (
              <span className="text-xs text-slate-400">
                {t("householdDetail.expires", { date: new Date(household.invite_expires_at).toLocaleString() })}
              </span>
            )}
            <IconButton icon={RefreshCw} label={t("householdDetail.regenerateInvite")} onClick={handleRegenerateInvite} />
          </div>
        </Card>
      )}

      <Card>
        <h2 className="font-medium mb-2 flex items-center gap-2 text-blue-950">
          <Users className="h-4 w-4 text-blue-700" />
          {t("householdDetail.members")}
        </h2>
        <div className="space-y-2">
          {household.memberships?.map((membership) => (
            <div key={membership.id} className="flex items-center justify-between text-sm">
              <span>
                {membership.user_email}
                {membership.user === user?.id && t("householdDetail.you")}
              </span>
              <div className="flex items-center gap-2">
                {myRole === "owner" && membership.user !== user?.id ? (
                  <Select
                    value={membership.role}
                    onChange={(e) => handleRoleChange(membership.id, e.target.value)}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {t(`roles.${role}`, role)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Badge color="blue">{t(`roles.${membership.role}`, membership.role)}</Badge>
                )}
                {canManage && membership.role !== "owner" && membership.user !== user?.id && (
                  <IconButton
                    icon={UserX}
                    label={t("householdDetail.removeMember")}
                    onClick={() => handleRemoveMember(membership.user)}
                    className="hover:text-red-600 hover:bg-red-50"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-medium mb-2 flex items-center gap-2 text-blue-950">
          <ListChecks className="h-4 w-4 text-blue-700" />
          {t("householdDetail.fakras")}
        </h2>
        {fakras.length === 0 ? (
          <p className="text-sm text-slate-500">{t("householdDetail.noFakras")}</p>
        ) : (
          <div className="space-y-2">
            {fakras.map((fakra) => (
              <Link to={`/fakras/${fakra.id}`} key={fakra.id}>
                <div className="group flex items-center justify-between text-sm py-1 hover:text-blue-800">
                  <span>{fakra.title}</span>
                  <div className="flex items-center gap-2">
                    <Badge color={fakra.status === "archived" ? "gray" : "green"}>{t(`common.${fakra.status}`, fakra.status)}</Badge>
                    <ChevronRight className="h-4 w-4 text-slate-300 transition-transform duration-150 group-hover:translate-x-1 group-hover:text-blue-600" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-3">
          <Link to="/" className="text-sm text-blue-700 hover:underline">
            {t("householdDetail.newFakraLink")}
          </Link>
        </div>
      </Card>
    </div>
  );
}
