import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import * as fakrasApi from "../../src/api/fakras";
import { Card, ErrorText, extractError } from "../../src/components/ui";
import LoadingScreen from "../../src/components/LoadingScreen";
import { colors } from "../../src/constants/colors";

function formatAmount(value) {
  return Number(value || 0).toFixed(2);
}

export default function Analytics() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fakrasApi.getSpendingAnalytics();
        setData(response.data);
      } catch (err) {
        setError(extractError(err));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <View style={styles.screen}>
        <ErrorText>{error}</ErrorText>
      </View>
    );
  }

  const byMonth = data.by_month;
  const byCategory = data.by_category;
  const byFakra = data.by_fakra;

  const maxMonthTotal = Math.max(1, ...byMonth.map((entry) => Number(entry.total)));
  const maxCategoryTotal = Math.max(1, ...byCategory.map((entry) => Number(entry.total)));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t("analytics.totalSpent")}</Text>
          <Text style={styles.summaryValue}>{formatAmount(data.total_spent)}</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t("analytics.spentThisMonth")}</Text>
          <Text style={styles.summaryValue}>{formatAmount(data.spent_this_month)}</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{t("analytics.budgetRemaining")}</Text>
          <Text style={styles.summaryValue}>{formatAmount(data.budget_remaining)}</Text>
        </Card>
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{t("analytics.spendingByMonth")}</Text>
        {byMonth.length === 0 ? (
          <Text style={styles.noData}>{t("analytics.noData")}</Text>
        ) : (
          byMonth.map((entry) => (
            <View key={entry.month} style={styles.barRow}>
              <Text style={styles.barLabel}>{entry.month}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(Number(entry.total) / maxMonthTotal) * 100}%`, backgroundColor: colors.blue700 },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{formatAmount(entry.total)}</Text>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{t("analytics.spendingByCategory")}</Text>
        {byCategory.length === 0 ? (
          <Text style={styles.noData}>{t("analytics.noData")}</Text>
        ) : (
          byCategory.map((entry) => (
            <View key={entry.category} style={styles.barRow}>
              <Text style={styles.barLabel} numberOfLines={1}>{entry.category}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(Number(entry.total) / maxCategoryTotal) * 100}%`, backgroundColor: colors.emerald600 },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{formatAmount(entry.total)}</Text>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{t("analytics.topFakras")}</Text>
        {byFakra.length === 0 ? (
          <Text style={styles.noData}>{t("analytics.noData")}</Text>
        ) : (
          byFakra.map((entry) => (
            <Text
              key={entry.fakra_id}
              style={styles.fakraRow}
              onPress={() => router.push(`/fakras/${entry.fakra_id}`)}
            >
              <Text style={styles.fakraLink}>{entry.title}</Text>
              <Text style={styles.fakraValue}>  {formatAmount(entry.total)}</Text>
            </Text>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate50 },
  content: { padding: 16, gap: 12 },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryCard: { flex: 1, gap: 4 },
  summaryLabel: { fontSize: 12, color: colors.slate500 },
  summaryValue: { fontSize: 18, fontWeight: "600", color: colors.blue950 },
  card: { gap: 8 },
  cardTitle: { fontWeight: "600", color: colors.blue950, marginBottom: 4 },
  noData: { fontSize: 14, color: colors.slate500 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { fontSize: 12, color: colors.slate500, width: 72 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.slate100 },
  barFill: { height: 10, borderRadius: 5 },
  barValue: { fontSize: 12, color: colors.slate700, width: 64, textAlign: "right" },
  fakraRow: { paddingVertical: 6, fontSize: 14 },
  fakraLink: { color: colors.blue700 },
  fakraValue: { color: colors.slate700 },
});
