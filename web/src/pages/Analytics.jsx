import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sparkles, RefreshCw } from "lucide-react";
import * as fakrasApi from "../api/fakras";
import { Card, ErrorText, Select, extractError } from "../components/ui";

function formatAmount(value) {
  return Number(value || 0).toFixed(2);
}

const RANGES = ["all", "week", "month", "year"];

export default function Analytics() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState("all");

  const [digest, setDigest] = useState(null);
  const [digestLoading, setDigestLoading] = useState(false);

  async function loadDigest() {
    setDigestLoading(true);
    try {
      const response = await fakrasApi.getSpendingDigest();
      setDigest(response.data.digest);
    } catch {
      setDigest(null);
    } finally {
      setDigestLoading(false);
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fakrasApi.getSpendingAnalytics(range === "all" ? {} : { range });
        setData(response.data);
      } catch (err) {
        setError(extractError(err));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [range]);

  useEffect(() => {
    loadDigest();
  }, []);

  if (loading && !data) {
    return <p className="text-sm text-slate-500">{t("common.loading")}</p>;
  }

  if (error) {
    return <ErrorText>{error}</ErrorText>;
  }

  const byMonth = data.by_month;
  const byCategory = data.by_category;
  const byFakra = data.by_fakra;
  const byMember = data.by_member || [];

  const maxMonthTotal = Math.max(1, ...byMonth.map((entry) => Number(entry.total)));
  const maxCategoryTotal = Math.max(1, ...byCategory.map((entry) => Number(entry.total)));
  const maxMemberTotal = Math.max(1, ...byMember.map((entry) => Number(entry.total)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold text-slate-900">{t("analytics.heading")}</h1>
        <div className="w-40">
          <Select value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map((r) => (
              <option key={r} value={r}>{t(`analytics.range.${r}`)}</option>
            ))}
          </Select>
        </div>
      </div>

      {(digestLoading || digest) && (
        <Card className="border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/40">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-teal-900 dark:text-teal-200">{t("analytics.digestTitle")}</p>
                <button
                  type="button"
                  onClick={loadDigest}
                  disabled={digestLoading}
                  className="text-teal-600 hover:text-teal-800 dark:text-teal-400 disabled:opacity-50"
                  aria-label={t("analytics.regenerate")}
                >
                  <RefreshCw className={`h-4 w-4 ${digestLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
              <p className="text-sm text-teal-800 dark:text-teal-100 mt-1">
                {digestLoading ? t("analytics.digestLoading") : digest}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-slate-500">{t("analytics.totalSpent")}</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{formatAmount(data.total_spent)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">{t("analytics.spentThisMonth")}</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{formatAmount(data.spent_this_month)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">{t("analytics.budgetRemaining")}</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{formatAmount(data.budget_remaining)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">{t("analytics.overBudget")}</p>
          <p className={`text-2xl font-semibold mt-1 ${data.over_budget_count > 0 ? "text-red-600" : "text-slate-900"}`}>
            {data.over_budget_count ?? 0}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">{t("analytics.spendingByMonth")}</h2>
        {byMonth.length === 0 ? (
          <p className="text-sm text-slate-500">{t("analytics.noData")}</p>
        ) : (
          <div className="space-y-2">
            {byMonth.map((entry) => (
              <div key={entry.month} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-16 shrink-0">{entry.month}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-3">
                  <div
                    className="bg-blue-700 h-3 rounded-full"
                    style={{ width: `${(Number(entry.total) / maxMonthTotal) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-700 w-16 text-right shrink-0">{formatAmount(entry.total)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">{t("analytics.spendingByCategory")}</h2>
        {byCategory.length === 0 ? (
          <p className="text-sm text-slate-500">{t("analytics.noData")}</p>
        ) : (
          <div className="space-y-2">
            {byCategory.map((entry) => (
              <div key={entry.category} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-24 shrink-0 truncate">{entry.category}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-3">
                  <div
                    className="bg-emerald-600 h-3 rounded-full"
                    style={{ width: `${(Number(entry.total) / maxCategoryTotal) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-700 w-16 text-right shrink-0">{formatAmount(entry.total)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">{t("analytics.byMember")}</h2>
        {byMember.length === 0 ? (
          <p className="text-sm text-slate-500">{t("analytics.noData")}</p>
        ) : (
          <div className="space-y-2">
            {byMember.map((entry) => (
              <div key={entry.member} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-40 shrink-0 truncate">{entry.member}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-3">
                  <div
                    className="bg-teal-600 h-3 rounded-full"
                    style={{ width: `${(Number(entry.total) / maxMemberTotal) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-700 w-16 text-right shrink-0">{formatAmount(entry.total)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">{t("analytics.topFakras")}</h2>
        {byFakra.length === 0 ? (
          <p className="text-sm text-slate-500">{t("analytics.noData")}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {byFakra.map((entry) => (
              <li key={entry.fakra_id} className="flex items-center justify-between py-2 text-sm">
                <Link to={`/fakras/${entry.fakra_id}`} className="text-blue-800 hover:underline">
                  {entry.title}
                </Link>
                <span className="text-slate-700">{formatAmount(entry.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
