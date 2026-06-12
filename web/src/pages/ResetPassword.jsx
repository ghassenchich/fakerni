import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as authApi from "../api/auth";
import AuthShell from "../components/AuthShell";
import { Button, ErrorText, Input, Label, extractError } from "../components/ui";

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authApi.confirmPasswordReset(email, code, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title={t("auth.resetPassword.title")} subtitle={t("auth.resetPassword.subtitle")}>
      {success ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-700">{t("auth.resetPassword.success")}</p>
          <Button onClick={() => navigate("/login")} className="w-full justify-center">
            {t("auth.resetPassword.logIn")}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>{t("common.email")}</Label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("auth.resetPassword.resetCode")}</Label>
            <Input
              required
              minLength={6}
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
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

          <ErrorText>{error}</ErrorText>

          <Button type="submit" disabled={loading} className="w-full justify-center">
            {loading ? t("auth.resetPassword.submitting") : t("auth.resetPassword.submit")}
          </Button>
        </form>
      )}

      <p className="text-sm text-center mt-4">
        <Link to="/login" className="text-blue-700 hover:underline">
          {t("common.backToLogin")}
        </Link>
      </p>
    </AuthShell>
  );
}
