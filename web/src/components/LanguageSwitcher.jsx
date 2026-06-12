import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "ar", label: "AR" },
];

export default function LanguageSwitcher({ className = "" }) {
  const { i18n } = useTranslation();

  return (
    <label className={`flex items-center gap-1.5 ${className}`}>
      <Languages className="h-4 w-4 text-blue-200" />
      <select
        value={i18n.resolvedLanguage}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        aria-label="Language"
        className="bg-transparent text-sm text-blue-100 border border-blue-800 rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code} className="text-slate-900">
            {lang.label}
          </option>
        ))}
      </select>
    </label>
  );
}
