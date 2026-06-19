import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as fakrasApi from "../api/fakras";
import { Card, ErrorText, extractError } from "../components/ui";

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
    return <p className="text-sm text-slate-500">{t("common.loading")}</p>;
  }

  if (error) {
    return <ErrorText>{error}</ErrorText>;
  }

  const byMonth = data.by_month;
  const byCategory = data.by_category;
  const byFakra = data.by_fakra;

  const maxMonthTotal = Math.max(1, ...byMonth.map((entry) => Number(entry.total)));
  const maxCategoryTotal = Math.max(1, ...byCategory.map((entry) => Number(entry.total)));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">{t("analytics.heading")}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
