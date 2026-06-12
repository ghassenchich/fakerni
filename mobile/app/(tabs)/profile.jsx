import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { KeyRound, LogOut, Save, UserCircle } from "lucide-react-native";
import { useAuth } from "../../src/context/AuthContext";
import * as usersApi from "../../src/api/users";
import { Button, Card, ErrorText, Input, Label, extractError } from "../../src/components/ui";
import LanguageSwitcher from "../../src/components/LanguageSwitcher";
import { colors } from "../../src/constants/colors";

export default function Profile() {
  const { user, refreshProfile, logout } = useAuth();
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

  async function handleNameSubmit() {
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

  async function handlePasswordSubmit() {
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{t("profile.heading")}</Text>

      <Card style={styles.card}>
        <View style={styles.cardTitleRow}>
          <UserCircle size={16} color={colors.blue700} />
          <Text style={styles.cardTitle}>{t("profile.account")}</Text>
        </View>
        <View style={styles.field}>
          <Label>{t("common.email")}</Label>
          <Input value={user?.email || ""} editable={false} />
        </View>
        <View style={styles.field}>
          <Label>{t("common.name")}</Label>
          <Input value={name} onChangeText={setName} />
        </View>

        <ErrorText>{nameError}</ErrorText>
        {nameSuccess ? <Text style={styles.successText}>{nameSuccess}</Text> : null}

        <Button disabled={nameLoading} onPress={handleNameSubmit}>
          <Save size={16} color={colors.white} />
          <Text style={styles.buttonLabel}>{nameLoading ? t("common.saving") : t("common.save")}</Text>
        </Button>
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardTitleRow}>
          <KeyRound size={16} color={colors.blue700} />
          <Text style={styles.cardTitle}>{t("profile.changePassword")}</Text>
        </View>
        <View style={styles.field}>
          <Label>{t("profile.currentPassword")}</Label>
          <Input secureTextEntry value={oldPassword} onChangeText={setOldPassword} />
        </View>
        <View style={styles.field}>
          <Label>{t("auth.resetPassword.newPassword")}</Label>
          <Input secureTextEntry value={newPassword} onChangeText={setNewPassword} />
        </View>

        <ErrorText>{pwError}</ErrorText>
        {pwSuccess ? <Text style={styles.successText}>{pwSuccess}</Text> : null}

        <Button disabled={pwLoading} onPress={handlePasswordSubmit}>
          <KeyRound size={16} color={colors.white} />
          <Text style={styles.buttonLabel}>{pwLoading ? t("profile.submitting") : t("profile.submit")}</Text>
        </Button>
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>{t("profile.language")}</Text>
        </View>
        <LanguageSwitcher />
      </Card>

      <Button variant="danger" onPress={logout}>
        <LogOut size={16} color={colors.red600} />
        <Text style={styles.dangerLabel}>{t("common.logOut")}</Text>
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate50 },
  content: { padding: 16, gap: 12 },
  heading: { fontSize: 18, fontWeight: "600", color: colors.blue950 },
  card: { gap: 12 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontWeight: "500", color: colors.blue950 },
  field: { marginBottom: 0 },
  successText: { fontSize: 14, color: colors.emerald600 },
  buttonLabel: { color: colors.white, fontSize: 14, fontWeight: "500" },
  dangerLabel: { color: colors.red600, fontSize: 14, fontWeight: "500" },
});
