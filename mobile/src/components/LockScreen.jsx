import { useState } from "react";
import { Fingerprint } from "lucide-react-native";
import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import AuthShell from "./AuthShell";
import { Button, ErrorText } from "./ui";
import { useAuth } from "../context/AuthContext";
import { colors } from "../constants/colors";

export default function LockScreen() {
  const { t } = useTranslation();
  const { unlock } = useAuth();
  const [error, setError] = useState("");

  async function handleUnlock() {
    setError("");
    const success = await unlock();
    if (!success) {
      setError(t("auth.lock.unlockFailed"));
    }
  }

  return (
    <AuthShell title={t("auth.lock.title")} subtitle={t("auth.lock.subtitle")}>
      <ErrorText>{error}</ErrorText>
      <Button onPress={handleUnlock}>
        <Fingerprint size={16} color={colors.white} />
        <Text style={{ color: colors.white, fontSize: 14, fontWeight: "500" }}>
          {t("auth.lock.unlock")}
        </Text>
      </Button>
    </AuthShell>
  );
}
