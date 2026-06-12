import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import * as authApi from "../../src/api/auth";
import AuthShell from "../../src/components/AuthShell";
import { Button, ErrorText, Input, Label, extractError } from "../../src/components/ui";
import { colors } from "../../src/constants/colors";

export default function ForgotPassword() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
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
        <View style={styles.sentBox}>
          <Text style={styles.sentText}>{t("auth.forgotPassword.sentMessage")}</Text>
          <Button
            onPress={() => router.push({ pathname: "/(auth)/reset-password", params: { email } })}
          >
            {t("auth.forgotPassword.enterCode")}
          </Button>
        </View>
      ) : (
        <>
          <View style={styles.field}>
            <Label>{t("common.email")}</Label>
            <Input
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <ErrorText>{error}</ErrorText>

          <Button disabled={loading} onPress={handleSubmit} style={styles.submit}>
            {loading ? t("auth.forgotPassword.submitting") : t("auth.forgotPassword.submit")}
          </Button>
        </>
      )}

      <Text style={styles.linkRow}>
        <Link href="/(auth)/login" style={styles.link}>
          {t("common.backToLogin")}
        </Link>
      </Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  submit: { marginTop: 4 },
  sentBox: { alignItems: "center", gap: 16 },
  sentText: { fontSize: 14, color: colors.slate700, textAlign: "center" },
  linkRow: { fontSize: 14, color: colors.slate700, textAlign: "center", marginTop: 16 },
  link: { fontSize: 14, color: colors.blue700 },
});
