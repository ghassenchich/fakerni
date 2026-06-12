import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../src/context/AuthContext";
import AuthShell from "../../src/components/AuthShell";
import { Button, ErrorText, Input, Label, extractError } from "../../src/components/ui";
import { colors } from "../../src/constants/colors";

export default function Register() {
  const { register } = useAuth();
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
      await register(email, password);
      router.replace("/");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="فكرني" subtitle={t("auth.register.subtitle")}>
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
        {loading ? t("auth.register.submitting") : t("auth.register.submit")}
      </Button>

      <Text style={styles.linkRow}>
        {t("auth.register.haveAccount")}{" "}
        <Link href="/(auth)/login" style={styles.link}>
          {t("auth.register.loginLink")}
        </Link>
      </Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  submit: { marginTop: 4 },
  linkRow: { fontSize: 14, color: colors.slate700, textAlign: "center", marginTop: 16 },
  link: { fontSize: 14, color: colors.blue700 },
});
