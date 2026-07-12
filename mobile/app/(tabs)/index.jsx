import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronRight, Plus, Sparkles, X } from "lucide-react-native";
import * as fakrasApi from "../../src/api/fakras";
import * as householdsApi from "../../src/api/households";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Input,
  Label,
  Select,
  SelectItem,
  Textarea,
  extractError,
} from "../../src/components/ui";
import { colors } from "../../src/constants/colors";
import { useUserSocket } from "../../src/hooks/useUserSocket";
import { getDueStatus } from "../../src/utils/dueStatus";

const STATUS_COLORS = {
  active: "green",
  archived: "gray",
};

const DUE_STATUS_COLORS = {
  dueSoon: "yellow",
  overdue: "red",
};

export default function Dashboard() {
  const router = useRouter();
  const { t } = useTranslation();
  const [fakras, setFakras] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("active");
  const [householdFilter, setHouseholdFilter] = useState("");
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [household, setHousehold] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const [nextPage, setNextPage] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [restock, setRestock] = useState([]);
  const [restockDismissed, setRestockDismissed] = useState(false);
  const [creatingRestock, setCreatingRestock] = useState(false);

  const loadFakras = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");

    try {
      const params = { page: pageNum };
      if (statusFilter) params.status = statusFilter;
      if (householdFilter && householdFilter !== "personal") params.household = householdFilter;
      if (search) params.search = search;

      const response = await fakrasApi.listFakras(params);
      let results = response.data.results ?? response.data;

      if (householdFilter === "personal") {
        results = results.filter((f) => !f.household);
      }

      setFakras((prev) => (append ? [...prev, ...results] : results));
      setNextPage(response.data?.next ? pageNum + 1 : null);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [statusFilter, householdFilter, search]);

  useEffect(() => {
    householdsApi.listHouseholds().then((response) => {
      setHouseholds(response.data.results ?? response.data);
    });
    fakrasApi
      .getRestockSuggestions()
      .then((response) => setRestock(response.data.suggestions ?? []))
      .catch(() => {});
  }, []);

  async function handleCreateRestockList() {
    setCreatingRestock(true);
    setError("");
    try {
      const res = await fakrasApi.createFakra({ title: t("dashboard.restock.listTitle") });
      const id = res.data.id;
      for (const s of restock) {
        await fakrasApi.createItem(id, {
          name: s.name,
          quantity: 1,
          unit: s.unit || "",
          category: s.category || "",
          estimated_price: s.avg_price ?? null,
        });
      }
      router.push(`/fakras/${id}`);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setCreatingRestock(false);
    }
  }

  useEffect(() => {
    loadFakras();
  }, [loadFakras]);

  useUserSocket((message) => {
    if (["fakra.created", "fakra.shared"].includes(message.event)) {
      loadFakras();
    }
  });

  async function handleCreate() {
    setCreateError("");
    setCreateLoading(true);

    try {
      await fakrasApi.createFakra({
        title,
        description: description || undefined,
        household: household || null,
        due_date: dueDate || null,
        recurrence,
      });
      setTitle("");
      setDescription("");
      setHousehold("");
      setDueDate("");
      setRecurrence("none");
      setShowCreate(false);
      loadFakras();
    } catch (err) {
      setCreateError(extractError(err));
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{t("dashboard.heading")}</Text>
        <Button onPress={() => setShowCreate((v) => !v)}>
          {showCreate ? <X size={16} color={colors.white} /> : <Plus size={16} color={colors.white} />}
          <Text style={styles.buttonLabel}>{showCreate ? t("common.cancel") : t("dashboard.newFakra")}</Text>
        </Button>
      </View>

      {restock.length > 0 && !restockDismissed && (
        <Card style={styles.restockCard}>
          <View style={styles.restockHeader}>
            <View style={styles.restockTitleRow}>
              <Sparkles size={16} color={colors.blue700} />
              <Text style={styles.restockTitle}>{t("dashboard.restock.title")}</Text>
            </View>
            <Pressable onPress={() => setRestockDismissed(true)} hitSlop={8}>
              <X size={16} color={colors.blue500} />
            </Pressable>
          </View>
          <Text style={styles.restockSubtitle}>{t("dashboard.restock.subtitle")}</Text>
          <View style={styles.restockChips}>
            {restock.map((s) => (
              <View key={s.name} style={styles.restockChip}>
                <Text style={styles.restockChipText}>
                  {s.name}
                  {s.avg_price != null ? ` ~${s.avg_price}` : ""}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.restockCta}>
            <Button onPress={handleCreateRestockList} disabled={creatingRestock}>
              <Plus size={16} color={colors.white} />
              <Text style={styles.buttonLabel}>
                {creatingRestock ? t("common.creating") : t("dashboard.restock.cta")}
              </Text>
            </Button>
          </View>
        </Card>
      )}

      {showCreate && (
        <Card style={styles.card}>
          <View style={styles.field}>
            <Label>{t("common.title")}</Label>
            <Input value={title} onChangeText={setTitle} />
          </View>
          <View style={styles.field}>
            <Label>{t("common.description")}</Label>
            <Textarea value={description} onChangeText={setDescription} />
          </View>
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Label>{t("common.household")}</Label>
              <Select selectedValue={household} onValueChange={setHousehold}>
                <SelectItem label={t("common.personal")} value="" />
                {households.map((h) => (
                  <SelectItem key={h.id} label={h.name} value={String(h.id)} />
                ))}
              </Select>
            </View>
            <View style={styles.flex1}>
              <Label>{t("common.dueDate")}</Label>
              <Input value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
            </View>
          </View>
          <View style={styles.field}>
            <Label>{t("common.recurrenceLabel")}</Label>
            <Select selectedValue={recurrence} onValueChange={setRecurrence}>
              <SelectItem label={t("common.recurrence.none")} value="none" />
              <SelectItem label={t("common.recurrence.daily")} value="daily" />
              <SelectItem label={t("common.recurrence.weekly")} value="weekly" />
              <SelectItem label={t("common.recurrence.monthly")} value="monthly" />
            </Select>
          </View>

          <ErrorText>{createError}</ErrorText>

          <Button disabled={createLoading} onPress={handleCreate} style={styles.field}>
            {createLoading ? t("common.creating") : t("common.create")}
          </Button>
        </Card>
      )}

      <Card style={styles.card}>
        <View style={styles.field}>
          <Label>{t("common.status")}</Label>
          <Select selectedValue={statusFilter} onValueChange={setStatusFilter}>
            <SelectItem label={t("common.all")} value="" />
            <SelectItem label={t("dashboard.statusActive")} value="active" />
            <SelectItem label={t("dashboard.statusArchived")} value="archived" />
          </Select>
        </View>
        <View style={styles.field}>
          <Label>{t("common.household")}</Label>
          <Select selectedValue={householdFilter} onValueChange={setHouseholdFilter}>
            <SelectItem label={t("common.all")} value="" />
            <SelectItem label={t("common.personal")} value="personal" />
            {households.map((h) => (
              <SelectItem key={h.id} label={h.name} value={String(h.id)} />
            ))}
          </Select>
        </View>
        <View>
          <Label>{t("common.search")}</Label>
          <Input value={search} onChangeText={setSearch} placeholder={t("dashboard.titleOrDescription")} />
        </View>
      </Card>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <Text style={styles.muted}>{t("common.loading")}</Text>
      ) : fakras.length === 0 ? (
        <Text style={styles.muted}>{t("dashboard.noFakras")}</Text>
      ) : (
        fakras.map((fakra) => (
          <Pressable key={fakra.id} onPress={() => router.push(`/fakras/${fakra.id}`)}>
            <Card style={styles.card}>
              <View style={styles.fakraRow}>
                <View style={styles.flex1}>
                  <Text style={styles.fakraTitle}>{fakra.title}</Text>
                  {fakra.description ? (
                    <Text style={styles.fakraDescription} numberOfLines={1}>
                      {fakra.description}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.fakraMeta}>
                  {fakra.due_date ? (
                    <View style={styles.dueDate}>
                      <CalendarDays size={14} color={colors.slate500} />
                      <Text style={styles.dueDateText}>
                        {new Date(fakra.due_date).toLocaleDateString()}
                      </Text>
                    </View>
                  ) : null}
                  <Badge color={STATUS_COLORS[fakra.status] || "gray"}>{t(`common.${fakra.status}`, fakra.status)}</Badge>
                  {getDueStatus(fakra) && (
                    <Badge color={DUE_STATUS_COLORS[getDueStatus(fakra)]}>{t(`common.${getDueStatus(fakra)}`)}</Badge>
                  )}
                  <ChevronRight size={16} color={colors.slate300} />
                </View>
              </View>
            </Card>
          </Pressable>
        ))
      )}

      {nextPage ? (
        <Button variant="secondary" onPress={() => loadFakras(nextPage, true)} disabled={loadingMore}>
          {loadingMore ? t("common.loading") : t("common.loadMore")}
        </Button>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate50 },
  content: { padding: 16, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontSize: 18, fontWeight: "600", color: colors.blue950 },
  buttonLabel: { color: colors.white, fontSize: 14, fontWeight: "500" },
  card: { gap: 12 },
  field: { marginBottom: 0 },
  row: { flexDirection: "row", gap: 12 },
  flex1: { flex: 1 },
  muted: { fontSize: 14, color: colors.slate500 },
  fakraRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  fakraTitle: { fontWeight: "500", color: colors.blue950 },
  fakraDescription: { fontSize: 14, color: colors.slate500 },
  fakraMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  dueDate: { flexDirection: "row", alignItems: "center", gap: 4 },
  dueDateText: { fontSize: 12, color: colors.slate500 },
  restockCard: { gap: 8, backgroundColor: colors.blue50, borderColor: colors.blue200, borderWidth: 1 },
  restockHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  restockTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  restockTitle: { fontSize: 15, fontWeight: "600", color: colors.blue900 },
  restockSubtitle: { fontSize: 13, color: colors.blue700 },
  restockChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  restockChip: { backgroundColor: colors.white, borderColor: colors.blue200, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  restockChipText: { fontSize: 12, color: colors.blue800 },
  restockCta: { marginTop: 4, alignItems: "flex-start" },
});
