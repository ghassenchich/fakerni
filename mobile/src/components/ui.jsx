import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { colors } from "../constants/colors";

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const buttonVariants = StyleSheet.create({
  primary: { backgroundColor: colors.blue800 },
  primaryDisabled: { backgroundColor: colors.blue300 },
  secondary: { backgroundColor: colors.slate100 },
  danger: { backgroundColor: colors.red50 },
  ghost: { backgroundColor: "transparent" },
});

const buttonTextVariants = StyleSheet.create({
  primary: { color: colors.white },
  secondary: { color: colors.slate700 },
  danger: { color: colors.red600 },
  ghost: { color: colors.blue800 },
});

export function Button({ children, variant = "primary", disabled = false, onPress, style }) {
  const bgStyle =
    variant === "primary" && disabled ? buttonVariants.primaryDisabled : buttonVariants[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        bgStyle,
        pressed && !disabled ? styles.buttonPressed : null,
        style,
      ]}
    >
      {typeof children === "string" ? (
        <Text style={[styles.buttonText, buttonTextVariants[variant]]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, disabled = false, style }) {
  const Icon = icon;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && !disabled ? styles.iconButtonPressed : null,
        disabled ? styles.iconButtonDisabled : null,
        style,
      ]}
    >
      <Icon size={16} color={colors.slate500} />
    </Pressable>
  );
}

export function Input(props) {
  return <TextInput style={styles.input} placeholderTextColor={colors.slate300} {...props} />;
}

export function Textarea(props) {
  return (
    <TextInput
      style={[styles.input, styles.textarea]}
      placeholderTextColor={colors.slate300}
      multiline
      {...props}
    />
  );
}

export function Select({ selectedValue, onValueChange, children }) {
  return (
    <View style={styles.input}>
      <Picker selectedValue={selectedValue} onValueChange={onValueChange} style={styles.picker}>
        {children}
      </Picker>
    </View>
  );
}

export const SelectItem = Picker.Item;

export function Label({ children }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <Text style={styles.errorText}>{children}</Text>;
}

const badgeColors = StyleSheet.create({
  gray: { backgroundColor: colors.slate100 },
  green: { backgroundColor: colors.emerald100 },
  blue: { backgroundColor: colors.blue100 },
  yellow: { backgroundColor: colors.amber100 },
});

const badgeTextColors = StyleSheet.create({
  gray: { color: colors.slate700 },
  green: { color: colors.emerald700 },
  blue: { color: colors.blue800 },
  yellow: { color: colors.amber700 },
});

export function Badge({ children, color = "gray" }) {
  return (
    <View style={[styles.badge, badgeColors[color]]}>
      <Text style={[styles.badgeText, badgeTextColors[color]]}>{children}</Text>
    </View>
  );
}

export function extractError(err) {
  const data = err?.response?.data;
  if (!data) return err?.message || "Something went wrong";
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  if (data.error) return data.error;

  const firstKey = Object.keys(data)[0];
  if (firstKey) {
    const value = data[firstKey];
    const message = Array.isArray(value) ? value[0] : value;
    return `${firstKey}: ${message}`;
  }

  return "Something went wrong";
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 12,
    padding: 16,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  iconButton: {
    height: 32,
    width: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonPressed: {
    backgroundColor: colors.blue50,
  },
  iconButtonDisabled: {
    opacity: 0.5,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.slate300,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.slate900,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  picker: {
    marginHorizontal: -8,
    marginVertical: -8,
    color: colors.slate900,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.slate700,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: colors.red600,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
