import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { usePushNotifications } from "../src/hooks/usePushNotifications";
import LoadingScreen from "../src/components/LoadingScreen";
import LockScreen from "../src/components/LockScreen";
import { i18nReady } from "../src/i18n";

function PushNotifications() {
  const { isAuthenticated } = useAuth();
  usePushNotifications(isAuthenticated);
  return null;
}

function AppStack() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="households/[id]" options={{ title: t("households.heading") }} />
      <Stack.Screen name="fakras/[id]" options={{ title: t("nav.fakras") }} />
    </Stack>
  );
}

function RootContent() {
  const { locked } = useAuth();

  if (locked) {
    return <LockScreen />;
  }

  return (
    <>
      <PushNotifications />
      <AppStack />
    </>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    i18nReady.then(() => setReady(true));
  }, []);

  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <AuthProvider>
      <RootContent />
    </AuthProvider>
  );
}
