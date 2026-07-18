import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, ChevronRight, KeyRound, ListChecks, LogOut, RefreshCw, Users, UserX, Wallet } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as householdsApi from "../api/households";
import * as fakrasApi from "../api/fakras";
import { useHouseholdSocket } from "../hooks/useHouseholdSocket";
import { Badge, Button, Card, ErrorText, IconButton, Select, extractError } from "../components/ui";
import { getDueStatus } from "../utils/dueStatus";

const DUE_STATUS_COLORS = {
  dueSoon: "yellow",
  overdue: "red",
};

const ROLES = ["owner", "admin", "member"];

export default function HouseholdDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [household, setHousehold] = useState(null);
  const [fakras, setFakras] = useState([]);
  const [balances, setBalances] = useState(null);
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
      householdsApi.getBalances(id).then((res) => setBalances(res.data)).catch(() => {});
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

      {balances && balances.total > 0 && (
        <Card>
          <h2 className="font-medium mb-3 flex items-center gap-2 text-blue-950">
            <Wallet className="h-4 w-4 text-blue-700" />
            {t("householdDetail.settleUp")}
          </h2>
          <p className="text-sm text-slate-500 mb-3">
            {t("householdDetail.totalSpent", { amount: Number(balances.total).toFixed(2) })}
          </p>
          <div className="space-y-1.5 mb-4">
            {balances.per_member.map((m) => (
              <div key={m.email} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">{m.name || m.email}</span>
                <span className={m.balance > 0 ? "text-emerald-600 font-medium" : m.balance < 0 ? "text-red-600 font-medium" : "text-slate-400"}>
                  {m.balance > 0
                    ? t("householdDetail.getsBack", { amount: m.balance.toFixed(2) })
                    : m.balance < 0
                      ? t("householdDetail.owes", { amount: Math.abs(m.balance).toFixed(2) })
                      : t("householdDetail.settled")}
                </span>
              </div>
            ))}
          </div>
          {balances.settlements.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-1.5">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{t("householdDetail.suggestedTransfers")}</p>
              {balances.settlements.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">{s.from}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-700 dark:text-slate-300">{s.to}</span>
                  <span className="ml-auto font-medium text-blue-800 dark:text-blue-300">{s.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

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
                    {getDueStatus(fakra) && (
                      <Badge color={DUE_STATUS_COLORS[getDueStatus(fakra)]}>{t(`common.${getDueStatus(fakra)}`)}</Badge>
                    )}
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
