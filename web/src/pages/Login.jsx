import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/AuthShell";
import { Button, ErrorText, Input, Label, extractError } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title={t("common.appName")} subtitle={t("auth.login.subtitle")}>
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
          <Label>{t("common.password")}</Label>
          <Input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <ErrorText>{error}</ErrorText>

        <Button type="submit" disabled={loading} className="w-full justify-center">
          {loading ? t("auth.login.submitting") : t("auth.login.submit")}
        </Button>
      </form>

      <div className="text-sm text-center mt-4 space-y-1">
        <p>
          <Link to="/forgot-password" className="text-blue-700 hover:underline">
            {t("auth.login.forgotPassword")}
          </Link>
        </p>
        <p>
          {t("auth.login.noAccount")}{" "}
          <Link to="/register" className="text-blue-700 hover:underline">
            {t("auth.login.registerLink")}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
