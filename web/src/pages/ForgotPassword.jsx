import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as authApi from "../api/auth";
import AuthShell from "../components/AuthShell";
import { Button, ErrorText, Input, Label, extractError } from "../components/ui";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authApi.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title={t("auth.forgotPassword.title")} subtitle={t("auth.forgotPassword.subtitle")}>
      {sent ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-700">{t("auth.forgotPassword.sentMessage")}</p>
          <Button
            onClick={() => navigate("/reset-password", { state: { email } })}
            className="w-full justify-center"
          >
            {t("auth.forgotPassword.enterCode")}
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

          <ErrorText>{error}</ErrorText>

          <Button type="submit" disabled={loading} className="w-full justify-center">
            {loading ? t("auth.forgotPassword.submitting") : t("auth.forgotPassword.submit")}
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
