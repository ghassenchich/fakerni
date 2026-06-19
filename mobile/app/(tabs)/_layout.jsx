import { Redirect, Tabs } from "expo-router";
import { BarChart3, ListChecks, UserCircle, Users } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../src/context/AuthContext";
import LoadingScreen from "../../src/components/LoadingScreen";
import { colors } from "../../src/constants/colors";

export default function TabsLayout() {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.blue950 },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: "600" },
        tabBarActiveTintColor: colors.blue800,
        tabBarInactiveTintColor: colors.slate500,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.fakras"),
          tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="households/index"
        options={{
          title: t("nav.households"),
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: t("nav.analytics"),
          tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarIcon: ({ color, size }) => <UserCircle color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
