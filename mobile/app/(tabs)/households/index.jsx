import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ChevronRight, KeyRound, Plus, Users } from "lucide-react-native";
import { useAuth } from "../../../src/context/AuthContext";
import * as householdsApi from "../../../src/api/households";
import { Badge, Button, Card, ErrorText, Input, Label, Select, SelectItem, extractError } from "../../../src/components/ui";
import { colors } from "../../../src/constants/colors";

const GROUP_TYPES = ["family", "community", "organization", "society", "other"];

export default function HouseholdsList() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [households, setHouseholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [type, setType] = useState("family");
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const [inviteCode, setInviteCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await householdsApi.listHouseholds();
      setHouseholds(response.data.results ?? response.data);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    setCreateError("");
    setCreateLoading(true);

    try {
      await householdsApi.createHousehold(name, type);
      setName("");
      setType("family");
      load();
    } catch (err) {
      setCreateError(extractError(err));
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleJoin() {
    setJoinError("");
    setJoinSuccess("");
    setJoinLoading(true);

    try {
      const response = await householdsApi.joinHousehold(inviteCode);
      setJoinSuccess(response.data.message || t("households.joinedSuccess"));
      setInviteCode("");
      load();
    } catch (err) {
      setJoinError(extractError(err));
    } finally {
      setJoinLoading(false);
    }
  }

  function myRole(household) {
    const membership = household.memberships?.find((m) => m.user === user?.id);
    return membership?.role;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{t("households.heading")}</Text>

      <Card style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Users size={16} color={colors.blue700} />
          <Text style={styles.cardTitle}>{t("households.createHousehold")}</Text>
        </View>
        <View style={styles.field}>
          <Label>{t("common.name")}</Label>
          <Input value={name} onChangeText={setName} />
        </View>
        <View style={styles.field}>
          <Label>{t("households.groupType")}</Label>
          <Select selectedValue={type} onValueChange={setType}>
            {GROUP_TYPES.map((gt) => (
              <SelectItem key={gt} label={t(`households.types.${gt}`)} value={gt} />
            ))}
          </Select>
        </View>
        <ErrorText>{createError}</ErrorText>
        <Button disabled={createLoading} onPress={handleCreate}>
          <Plus size={16} color={colors.white} />
          <Text style={styles.buttonLabel}>{createLoading ? t("common.creating") : t("common.create")}</Text>
        </Button>
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardTitleRow}>
          <KeyRound size={16} color={colors.blue700} />
          <Text style={styles.cardTitle}>{t("households.joinWithCode")}</Text>
        </View>
        <View style={styles.field}>
          <Label>{t("households.inviteCode")}</Label>
          <Input value={inviteCode} onChangeText={setInviteCode} />
        </View>
        <ErrorText>{joinError}</ErrorText>
        {joinSuccess ? <Text style={styles.successText}>{joinSuccess}</Text> : null}
        <Button disabled={joinLoading} onPress={handleJoin}>
          {joinLoading ? t("households.joining") : t("households.join")}
        </Button>
      </Card>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <Text style={styles.muted}>{t("common.loading")}</Text>
      ) : households.length === 0 ? (
        <Text style={styles.muted}>{t("households.noHouseholds")}</Text>
      ) : (
        households.map((household) => (
          <Pressable key={household.id} onPress={() => router.push(`/households/${household.id}`)}>
            <Card style={styles.card}>
              <View style={styles.householdRow}>
                <View>
                  <View style={styles.householdNameRow}>
                    <Text style={styles.householdName}>{household.name}</Text>
                    {household.type ? (
                      <Badge color="teal">{t(`households.types.${household.type}`, household.type)}</Badge>
                    ) : null}
                  </View>
                  <Text style={styles.muted}>
                    {household.memberships?.length ?? 0}{" "}
                    {household.memberships?.length === 1 ? t("households.member") : t("households.members")}
                  </Text>
                </View>
                <View style={styles.householdMeta}>
                  <Badge color="blue">{t(`roles.${myRole(household)}`, myRole(household))}</Badge>
                  <ChevronRight size={16} color={colors.slate300} />
                </View>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate50 },
  content: { padding: 16, gap: 12 },
  heading: { fontSize: 18, fontWeight: "600", color: colors.blue950 },
  card: { gap: 12 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontWeight: "500", color: colors.blue950 },
  field: { marginBottom: 0 },
  buttonLabel: { color: colors.white, fontSize: 14, fontWeight: "500" },
  successText: { fontSize: 14, color: colors.emerald600 },
  muted: { fontSize: 14, color: colors.slate500 },
  householdRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  householdNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  householdName: { fontWeight: "500", color: colors.blue950 },
  householdMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
});
