import { Sparkles } from "lucide-react-native";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Card } from "./ui";
import { colors } from "../constants/colors";

export default function AuthShell({ title, subtitle, children }) {
  return (
    <LinearGradient
      colors={[colors.blue950, colors.blue900, colors.slate900]}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Card style={styles.card}>
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Sparkles size={24} color={colors.blue800} />
              </View>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            {children}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradient: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 384,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconCircle: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: colors.blue100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.slate900,
  },
  subtitle: {
    fontSize: 14,
    color: colors.slate500,
    textAlign: "center",
    marginTop: 4,
  },
});
