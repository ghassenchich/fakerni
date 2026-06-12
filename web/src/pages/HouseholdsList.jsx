import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, KeyRound, Plus, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as householdsApi from "../api/households";
import { Badge, Button, Card, ErrorText, Input, Label, extractError } from "../components/ui";

export default function HouseholdsList() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [households, setHouseholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
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

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);

    try {
      await householdsApi.createHousehold(name);
      setName("");
      load();
    } catch (err) {
      setCreateError(extractError(err));
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
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
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-blue-950">{t("households.heading")}</h1>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-medium mb-3 flex items-center gap-2 text-blue-950">
            <Users className="h-4 w-4 text-blue-700" />
            {t("households.createHousehold")}
          </h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <Label>{t("common.name")}</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <ErrorText>{createError}</ErrorText>
            <Button type="submit" disabled={createLoading}>
              <Plus className="h-4 w-4" />
              {createLoading ? t("common.creating") : t("common.create")}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="font-medium mb-3 flex items-center gap-2 text-blue-950">
            <KeyRound className="h-4 w-4 text-blue-700" />
            {t("households.joinWithCode")}
          </h2>
          <form onSubmit={handleJoin} className="space-y-3">
            <div>
              <Label>{t("households.inviteCode")}</Label>
              <Input required value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
            </div>
            <ErrorText>{joinError}</ErrorText>
            {joinSuccess && <p className="text-sm text-green-600">{joinSuccess}</p>}
            <Button type="submit" disabled={joinLoading}>
              {joinLoading ? t("households.joining") : t("households.join")}
            </Button>
          </form>
        </Card>
      </div>

      <ErrorText>{error}</ErrorText>

      {loading ? (
        <p className="text-sm text-slate-500">{t("common.loading")}</p>
      ) : households.length === 0 ? (
        <p className="text-sm text-slate-500">{t("households.noHouseholds")}</p>
      ) : (
        <div className="space-y-2">
          {households.map((household) => (
            <Link to={`/households/${household.id}`} key={household.id}>
              <Card className="group hover:border-blue-300 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-blue-950">{household.name}</p>
                    <p className="text-sm text-slate-500">
                      {household.memberships?.length ?? 0}{" "}
                      {household.memberships?.length === 1 ? t("households.member") : t("households.members")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color="blue">{t(`roles.${myRole(household)}`, myRole(household))}</Badge>
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
