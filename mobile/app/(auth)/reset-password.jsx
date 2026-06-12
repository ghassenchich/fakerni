import { useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import * as authApi from "../../src/api/auth";
import AuthShell from "../../src/components/AuthShell";
import { Button, ErrorText, Input, Label, extractError } from "../../src/components/ui";
import { colors } from "../../src/constants/colors";

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t } = useTranslation();
  const [email, setEmail] = useState(params.email || "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
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
        <View style={styles.sentBox}>
          <Text style={styles.sentText}>{t("auth.resetPassword.success")}</Text>
          <Button onPress={() => router.replace("/(auth)/login")}>{t("auth.resetPassword.logIn")}</Button>
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
          <View style={styles.field}>
            <Label>{t("auth.resetPassword.resetCode")}</Label>
            <Input maxLength={6} value={code} onChangeText={setCode} />
          </View>
          <View style={styles.field}>
            <Label>{t("auth.resetPassword.newPassword")}</Label>
            <Input secureTextEntry value={newPassword} onChangeText={setNewPassword} />
          </View>

          <ErrorText>{error}</ErrorText>

          <Button disabled={loading} onPress={handleSubmit} style={styles.submit}>
            {loading ? t("auth.resetPassword.submitting") : t("auth.resetPassword.submit")}
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
