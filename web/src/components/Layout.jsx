import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ListChecks, LogOut, Users, UserCircle, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import LanguageSwitcher from "./LanguageSwitcher";

const navLinkClass = ({ isActive }) =>
  `group flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
    isActive
      ? "bg-blue-800 text-white"
      : "text-blue-100 hover:bg-blue-800/60 hover:text-white"
  }`;

const iconClass = "h-4 w-4 transition-transform duration-150 group-hover:scale-110";

export default function Layout() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-blue-950 px-4 sm:px-6 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            <span className="flex items-center gap-2 font-semibold text-white mr-4">
              <Sparkles className="h-5 w-5 text-blue-300" />
              {t("common.appName")}
            </span>
            <NavLink to="/" className={navLinkClass} end>
              <ListChecks className={iconClass} />
              {t("nav.fakras")}
            </NavLink>
            <NavLink to="/households" className={navLinkClass}>
              <Users className={iconClass} />
              {t("nav.households")}
            </NavLink>
            <NavLink to="/profile" className={navLinkClass}>
              <UserCircle className={iconClass} />
              {t("nav.profile")}
            </NavLink>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {user && <span className="text-sm text-blue-200 hidden sm:inline">{user.email}</span>}
            <button
              onClick={logout}
              className="group flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-blue-100 hover:bg-blue-800/60 hover:text-white transition-colors duration-150"
            >
              <LogOut className={iconClass} />
              {t("common.logOut")}
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
