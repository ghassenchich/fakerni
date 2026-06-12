import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../src/context/AuthContext";
import AuthShell from "../../src/components/AuthShell";
import { Button, ErrorText, Input, Label, extractError } from "../../src/components/ui";
import { colors } from "../../src/constants/colors";

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="فكرني" subtitle={t("auth.login.subtitle")}>
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
        <Label>{t("common.password")}</Label>
        <Input secureTextEntry value={password} onChangeText={setPassword} />
      </View>

      <ErrorText>{error}</ErrorText>

      <Button disabled={loading} onPress={handleSubmit} style={styles.submit}>
        {loading ? t("auth.login.submitting") : t("auth.login.submit")}
      </Button>

      <View style={styles.links}>
        <Link href="/(auth)/forgot-password" style={styles.link}>
          {t("auth.login.forgotPassword")}
        </Link>
        <Text style={styles.linkRow}>
          {t("auth.login.noAccount")}{" "}
          <Link href="/(auth)/register" style={styles.link}>
            {t("auth.login.registerLink")}
          </Link>
        </Text>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  submit: { marginTop: 4 },
  links: { marginTop: 16, alignItems: "center", gap: 4 },
  linkRow: { fontSize: 14, color: colors.slate700 },
  link: { fontSize: 14, color: colors.blue700 },
});
