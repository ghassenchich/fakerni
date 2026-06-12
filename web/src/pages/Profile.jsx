import { useState } from "react";
import { KeyRound, Save, UserCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import * as usersApi from "../api/users";
import { Button, Card, ErrorText, Input, Label, extractError } from "../components/ui";

export default function Profile() {
  const { user, refreshProfile } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState(user?.name || "");
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState("");
  const [nameLoading, setNameLoading] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  async function handleNameSubmit(e) {
    e.preventDefault();
    setNameError("");
    setNameSuccess("");
    setNameLoading(true);

    try {
      await usersApi.updateProfile({ name });
      await refreshProfile();
      setNameSuccess(t("profile.profileUpdated"));
    } catch (err) {
      setNameError(extractError(err));
    } finally {
      setNameLoading(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    setPwLoading(true);

    try {
      await usersApi.changePassword(oldPassword, newPassword);
      setPwSuccess(t("profile.passwordUpdated"));
      setOldPassword("");
      setNewPassword("");
    } catch (err) {
      setPwError(extractError(err));
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-lg font-semibold text-blue-950">{t("profile.heading")}</h1>

      <Card>
        <h2 className="font-medium mb-3 flex items-center gap-2 text-blue-950">
          <UserCircle className="h-4 w-4 text-blue-700" />
          {t("profile.account")}
        </h2>
        <form onSubmit={handleNameSubmit} className="space-y-3">
          <div>
            <Label>{t("common.email")}</Label>
            <Input value={user?.email || ""} disabled />
          </div>
          <div>
            <Label>{t("common.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <ErrorText>{nameError}</ErrorText>
          {nameSuccess && <p className="text-sm text-green-600">{nameSuccess}</p>}

          <Button type="submit" disabled={nameLoading}>
            <Save className="h-4 w-4" />
            {nameLoading ? t("common.saving") : t("common.save")}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-medium mb-3 flex items-center gap-2 text-blue-950">
          <KeyRound className="h-4 w-4 text-blue-700" />
          {t("profile.changePassword")}
        </h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <div>
            <Label>{t("profile.currentPassword")}</Label>
            <Input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("auth.resetPassword.newPassword")}</Label>
            <Input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <ErrorText>{pwError}</ErrorText>
          {pwSuccess && <p className="text-sm text-green-600">{pwSuccess}</p>}

          <Button type="submit" disabled={pwLoading}>
            <KeyRound className="h-4 w-4" />
            {pwLoading ? t("profile.submitting") : t("profile.submit")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
