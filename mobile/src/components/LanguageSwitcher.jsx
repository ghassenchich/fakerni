import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "../i18n";
import { colors } from "../constants/colors";

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "ar", label: "AR" },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <View style={styles.row}>
      {LANGUAGES.map((lang) => {
        const active = i18n.resolvedLanguage === lang.code;
        return (
          <Pressable
            key={lang.code}
            onPress={() => changeLanguage(lang.code)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{lang.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.slate100,
  },
  pillActive: {
    backgroundColor: colors.blue800,
  },
  label: { fontSize: 13, fontWeight: "500", color: colors.slate700 },
  labelActive: { color: colors.white },
});
