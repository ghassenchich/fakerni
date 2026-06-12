import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as usersApi from "../api/users";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function platformName() {
  if (Platform.OS === "android") return "android";
  if (Platform.OS === "ios") return "ios";
  return "web";
}

export function usePushNotifications(isAuthenticated) {
  const registeredTokenRef = useRef(null);

  useEffect(() => {
    if (Platform.OS === "web") return;

    if (!isAuthenticated) {
      const token = registeredTokenRef.current;
      if (token) {
        registeredTokenRef.current = null;
        usersApi.unregisterDeviceToken(token).catch(() => {});
      }
      return;
    }

    let cancelled = false;

    (async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") return;

      try {
        const { data: token } = await Notifications.getDevicePushTokenAsync();
        if (cancelled || !token) return;

        await usersApi.registerDeviceToken(token, platformName());
        registeredTokenRef.current = token;
      } catch {
        // device push tokens require a native build with Firebase/APNs
        // configured; silently skip on environments without it (e.g. Expo Go)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);
}
