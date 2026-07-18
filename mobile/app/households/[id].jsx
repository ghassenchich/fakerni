import { useCallback, useEffect, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ChevronRight, KeyRound, ListChecks, LogOut, RefreshCw, Users, UserX, Wallet } from "lucide-react-native";
import { useAuth } from "../../src/context/AuthContext";
import * as householdsApi from "../../src/api/households";
import * as fakrasApi from "../../src/api/fakras";
import { useHouseholdSocket } from "../../src/hooks/useHouseholdSocket";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  IconButton,
  Select,
  SelectItem,
  extractError,
} from "../../src/components/ui";
import { colors } from "../../src/constants/colors";
import { getDueStatus } from "../../src/utils/dueStatus";

const DUE_STATUS_COLORS = {
  dueSoon: "yellow",
  overdue: "red",
};

const ROLES = ["owner", "admin", "member"];

export default function HouseholdDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
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
      router.replace("/(tabs)/households");
    } catch (err) {
      setActionError(extractError(err));
    }
  }

  if (loading && !household) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t("common.loading")}</Text>
      </View>
    );
  }
  if (error && !household) {
    return (
      <View style={styles.center}>
        <ErrorText>{error}</ErrorText>
      </View>
    );
  }
  if (!household) return null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{household.name}</Text>
        {myRole !== "owner" && (
          <Button variant="danger" onPress={handleLeave}>
            <LogOut size={16} color={colors.red600} />
            <Text style={styles.dangerLabel}>{t("householdDetail.leave")}</Text>
          </Button>
        )}
      </View>

      <ErrorText>{actionError}</ErrorText>

      {canManage && (
        <Card style={styles.card}>
          <View style={styles.cardTitleRow}>
            <KeyRound size={16} color={colors.blue700} />
            <Text style={styles.cardTitle}>{t("householdDetail.inviteCode")}</Text>
          </View>
          <View style={styles.inviteRow}>
            <Text style={styles.inviteCode}>{household.invite_code}</Text>
            <IconButton icon={RefreshCw} label={t("householdDetail.regenerateInvite")} onPress={handleRegenerateInvite} />
          </View>
          {household.invite_expires_at ? (
            <Text style={styles.muted}>
              {t("householdDetail.expires", { date: new Date(household.invite_expires_at).toLocaleString() })}
            </Text>
          ) : null}
        </Card>
      )}

      <Card style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Users size={16} color={colors.blue700} />
          <Text style={styles.cardTitle}>{t("householdDetail.members")}</Text>
        </View>
        {household.memberships?.map((membership) => (
          <View key={membership.id} style={styles.memberRow}>
            <Text style={styles.memberEmail}>
              {membership.user_email}
              {membership.user === user?.id ? t("householdDetail.you") : ""}
            </Text>
            <View style={styles.memberActions}>
              {myRole === "owner" && membership.user !== user?.id ? (
                <View style={styles.roleSelect}>
                  <Select
                    selectedValue={membership.role}
                    onValueChange={(role) => handleRoleChange(membership.id, role)}
                  >
                    {ROLES.map((role) => (
                      <SelectItem key={role} label={t(`roles.${role}`, role)} value={role} />
                    ))}
                  </Select>
                </View>
              ) : (
                <Badge color="blue">{t(`roles.${membership.role}`, membership.role)}</Badge>
              )}
              {canManage && membership.role !== "owner" && membership.user !== user?.id && (
                <IconButton
                  icon={UserX}
                  label={t("householdDetail.removeMember")}
                  onPress={() => handleRemoveMember(membership.user)}
                />
              )}
            </View>
          </View>
        ))}
      </Card>

      {balances && balances.total > 0 ? (
        <Card style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Wallet size={16} color={colors.blue700} />
            <Text style={styles.cardTitle}>{t("householdDetail.settleUp")}</Text>
          </View>
          <Text style={styles.muted}>{t("householdDetail.totalSpent", { amount: Number(balances.total).toFixed(2) })}</Text>
          <View style={styles.balanceList}>
            {balances.per_member.map((m) => (
              <View key={m.email} style={styles.balanceRow}>
                <Text style={styles.balanceName}>{m.name || m.email}</Text>
                <Text style={m.balance > 0 ? styles.balancePos : m.balance < 0 ? styles.balanceNeg : styles.muted}>
                  {m.balance > 0
                    ? t("householdDetail.getsBack", { amount: m.balance.toFixed(2) })
                    : m.balance < 0
                      ? t("householdDetail.owes", { amount: Math.abs(m.balance).toFixed(2) })
                      : t("householdDetail.settled")}
                </Text>
              </View>
            ))}
          </View>
          {balances.settlements.length > 0 ? (
            <View style={styles.settlementBlock}>
              <Text style={styles.settlementLabel}>{t("householdDetail.suggestedTransfers")}</Text>
              {balances.settlements.map((s, i) => (
                <Text key={i} style={styles.settlementRow}>
                  {s.from} → {s.to}   <Text style={styles.settlementAmount}>{s.amount.toFixed(2)}</Text>
                </Text>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <View style={styles.cardTitleRow}>
          <ListChecks size={16} color={colors.blue700} />
          <Text style={styles.cardTitle}>{t("householdDetail.fakras")}</Text>
        </View>
        {fakras.length === 0 ? (
          <Text style={styles.muted}>{t("householdDetail.noFakras")}</Text>
        ) : (
          fakras.map((fakra) => (
            <Pressable key={fakra.id} onPress={() => router.push(`/fakras/${fakra.id}`)}>
              <View style={styles.fakraRow}>
                <Text style={styles.fakraTitle}>{fakra.title}</Text>
                <View style={styles.fakraMeta}>
                  <Badge color={fakra.status === "archived" ? "gray" : "green"}>{t(`common.${fakra.status}`, fakra.status)}</Badge>
                  {getDueStatus(fakra) && (
                    <Badge color={DUE_STATUS_COLORS[getDueStatus(fakra)]}>{t(`common.${getDueStatus(fakra)}`)}</Badge>
                  )}
                  <ChevronRight size={16} color={colors.slate300} />
                </View>
              </View>
            </Pressable>
          ))
        )}
        <Link href="/" style={styles.link}>
          {t("householdDetail.newFakraLink")}
        </Link>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate50 },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontSize: 18, fontWeight: "600", color: colors.blue950 },
  dangerLabel: { color: colors.red600, fontSize: 14, fontWeight: "500" },
  card: { gap: 8 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { fontWeight: "500", color: colors.blue950 },
  balanceList: { gap: 6, marginTop: 4 },
  balanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  balanceName: { fontSize: 14, color: colors.slate700 },
  balancePos: { fontSize: 14, color: colors.emerald600, fontWeight: "600" },
  balanceNeg: { fontSize: 14, color: colors.red600, fontWeight: "600" },
  settlementBlock: { borderTopWidth: 1, borderTopColor: colors.slate100, paddingTop: 8, marginTop: 8, gap: 4 },
  settlementLabel: { fontSize: 11, textTransform: "uppercase", color: colors.slate400, marginBottom: 2 },
  settlementRow: { fontSize: 14, color: colors.slate700 },
  settlementAmount: { fontWeight: "600", color: colors.blue800 },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  inviteCode: {
    backgroundColor: colors.blue50,
    color: colors.blue950,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 14,
    fontFamily: "monospace",
  },
  muted: { fontSize: 14, color: colors.slate500 },
  memberRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  memberEmail: { fontSize: 14, color: colors.slate900, flex: 1, marginRight: 8 },
  memberActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  roleSelect: { width: 130 },
  fakraRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  fakraTitle: { fontSize: 14, color: colors.slate900 },
  fakraMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  link: { fontSize: 14, color: colors.blue700, marginTop: 8 },
});
