import AsyncStorage from "@react-native-async-storage/async-storage";

const BIOMETRIC_ENABLED_KEY = "fakerni_biometric_enabled";

export async function getBiometricEnabled() {
  const value = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
  return value === "true";
}

export async function setBiometricEnabled(enabled) {
  if (enabled) {
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
  } else {
    await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  }
}
