import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import LoadingScreen from "../../src/components/LoadingScreen";

export default function AuthLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
