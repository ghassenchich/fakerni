import { Sparkles } from "lucide-react";
import { Card } from "./ui";
import LanguageSwitcher from "./LanguageSwitcher";

export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 px-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
            <Sparkles className="h-6 w-6 text-blue-800" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 text-center mt-1">{subtitle}</p>}
        </div>
        {children}
      </Card>
    </div>
  );
}
