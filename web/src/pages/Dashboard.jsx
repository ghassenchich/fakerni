import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronRight, Plus, X } from "lucide-react";
import * as fakrasApi from "../api/fakras";
import * as householdsApi from "../api/households";
import { Badge, Button, Card, ErrorText, Input, Label, Select, Textarea, extractError } from "../components/ui";
import { getDueStatus } from "../utils/dueStatus";

const STATUS_COLORS = {
  active: "green",
  archived: "gray",
};

const DUE_STATUS_COLORS = {
  dueSoon: "yellow",
  overdue: "red",
};

export default function Dashboard() {
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

  async function loadFakras() {
    setLoading(true);
    setError("");

    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (householdFilter && householdFilter !== "personal") params.household = householdFilter;
      if (search) params.search = search;

      const response = await fakrasApi.listFakras(params);
      let results = response.data.results ?? response.data;

      if (householdFilter === "personal") {
        results = results.filter((f) => !f.household);
      }

      setFakras(results);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    householdsApi.listHouseholds().then((response) => {
      setHouseholds(response.data.results ?? response.data);
    });
  }, []);

  useEffect(() => {
    loadFakras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, householdFilter, search]);

  async function handleCreate(e) {
    e.preventDefault();
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-blue-950">{t("dashboard.heading")}</h1>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreate ? t("common.cancel") : t("dashboard.newFakra")}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label>{t("common.title")}</Label>
              <Input required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>{t("common.description")}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("common.household")}</Label>
                <Select value={household} onChange={(e) => setHousehold(e.target.value)}>
                  <option value="">{t("common.personal")}</option>
                  {households.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>{t("common.dueDate")}</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <Label>{t("common.recurrenceLabel")}</Label>
                <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                  <option value="none">{t("common.recurrence.none")}</option>
                  <option value="daily">{t("common.recurrence.daily")}</option>
                  <option value="weekly">{t("common.recurrence.weekly")}</option>
                  <option value="monthly">{t("common.recurrence.monthly")}</option>
                </Select>
              </div>
            </div>

            <ErrorText>{createError}</ErrorText>

            <Button type="submit" disabled={createLoading}>
              {createLoading ? t("common.creating") : t("common.create")}
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label>{t("common.status")}</Label>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t("common.all")}</option>
              <option value="active">{t("common.active")}</option>
              <option value="archived">{t("common.archived")}</option>
            </Select>
          </div>
          <div>
            <Label>{t("common.household")}</Label>
            <Select value={householdFilter} onChange={(e) => setHouseholdFilter(e.target.value)}>
              <option value="">{t("common.all")}</option>
              <option value="personal">{t("common.personal")}</option>
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <Label>{t("common.search")}</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("dashboard.titleOrDescription")} />
          </div>
        </div>
      </Card>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className="text-sm text-slate-500">{t("common.loading")}</p>
      ) : fakras.length === 0 ? (
        <p className="text-sm text-slate-500">{t("dashboard.noFakras")}</p>
      ) : (
        <div className="space-y-2">
          {fakras.map((fakra) => (
            <Link to={`/fakras/${fakra.id}`} key={fakra.id}>
              <Card className="group hover:border-blue-300 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-blue-950">{fakra.title}</p>
                    {fakra.description && (
                      <p className="text-sm text-slate-500 line-clamp-1">{fakra.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {fakra.due_date && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(fakra.due_date).toLocaleDateString()}
                      </span>
                    )}
                    <Badge color={STATUS_COLORS[fakra.status] || "gray"}>{t(`common.${fakra.status}`, fakra.status)}</Badge>
                    {getDueStatus(fakra) && (
                      <Badge color={DUE_STATUS_COLORS[getDueStatus(fakra)]}>{t(`common.${getDueStatus(fakra)}`)}</Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-300 transition-transform duration-150 group-hover:translate-x-1 group-hover:text-blue-600" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
