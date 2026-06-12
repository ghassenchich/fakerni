import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/AuthShell";
import { Button, ErrorText, Input, Label, extractError } from "../components/ui";

export default function Register() {
  const { register } = useAuth();
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
      await register(email, password);
      navigate("/");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title={t("common.appName")} subtitle={t("auth.register.subtitle")}>
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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <ErrorText>{error}</ErrorText>

        <Button type="submit" disabled={loading} className="w-full justify-center">
          {loading ? t("auth.register.submitting") : t("auth.register.submit")}
        </Button>
      </form>

      <p className="text-sm text-center mt-4">
        {t("auth.register.haveAccount")}{" "}
        <Link to="/login" className="text-blue-700 hover:underline">
          {t("auth.register.loginLink")}
        </Link>
      </p>
    </AuthShell>
  );
}
