import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import HouseholdsList from "./pages/HouseholdsList";
import HouseholdDetail from "./pages/HouseholdDetail";
import FakraDetail from "./pages/FakraDetail";
import Profile from "./pages/Profile";
import Analytics from "./pages/Analytics";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/households" element={<HouseholdsList />} />
            <Route path="/households/:id" element={<HouseholdDetail />} />
            <Route path="/fakras/:id" element={<FakraDetail />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
