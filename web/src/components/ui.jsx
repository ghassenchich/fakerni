export function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-[0_4px_20px_rgba(0,54,61,0.05)] dark:shadow-none p-4 transition-shadow ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const variants = {
    primary:
      "bg-blue-800 text-white hover:bg-blue-900 disabled:bg-blue-300 shadow-sm hover:shadow dark:bg-blue-700 dark:hover:bg-blue-600",
    secondary:
      "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900",
    ghost: "bg-transparent text-blue-800 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-800",
  };

  return (
    <button
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({ icon, label, className = "", ...props }) {
  const Icon = icon;
  return (
    <button
      title={label}
      aria-label={label}
      className={`group inline-flex items-center justify-center h-8 w-8 rounded-full text-slate-500 hover:text-blue-800 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-300 dark:hover:bg-slate-800 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      <Icon className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
    </button>
  );
}

export function Input(props) {
  return (
    <input
      className="w-full bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700 dark:focus:ring-blue-500 dark:focus:border-blue-500 transition-shadow"
      {...props}
    />
  );
}

export function Textarea(props) {
  return (
    <textarea
      className="w-full bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700 dark:focus:ring-blue-500 dark:focus:border-blue-500 transition-shadow"
      {...props}
    />
  );
}

export function Select(props) {
  return (
    <select
      className="w-full bg-slate-50 dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700 dark:focus:ring-blue-500 dark:focus:border-blue-500 transition-shadow"
      {...props}
    />
  );
}

export function Label({ children }) {
  return <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{children}</label>;
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <p className="text-sm text-red-600 dark:text-red-400 mt-1">{children}</p>;
}

export function Badge({ children, color = "gray" }) {
  const colors = {
    gray: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    teal: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
    yellow: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  };

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

export function extractError(err) {
  // Rate limited (throttling on auth / AI endpoints) — show a friendly message.
  if (err?.response?.status === 429) {
    return "Too many requests — please wait a moment and try again.";
  }

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
