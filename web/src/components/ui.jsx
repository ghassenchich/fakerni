export function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl shadow-sm p-4 transition-shadow ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const variants = {
    primary:
      "bg-blue-800 text-white hover:bg-blue-900 disabled:bg-blue-300 shadow-sm hover:shadow",
    secondary:
      "bg-slate-100 text-slate-700 hover:bg-slate-200",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    ghost: "bg-transparent text-blue-800 hover:bg-blue-50",
  };

  return (
    <button
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${className}`}
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
      className={`group inline-flex items-center justify-center h-8 w-8 rounded-full text-slate-500 hover:text-blue-800 hover:bg-blue-50 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      <Icon className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
    </button>
  );
}

export function Input(props) {
  return (
    <input
      className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
      {...props}
    />
  );
}

export function Textarea(props) {
  return (
    <textarea
      className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
      {...props}
    />
  );
}

export function Select(props) {
  return (
    <select
      className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
      {...props}
    />
  );
}

export function Label({ children }) {
  return <label className="block text-sm font-medium text-slate-700 mb-1">{children}</label>;
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <p className="text-sm text-red-600 mt-1">{children}</p>;
}

export function Badge({ children, color = "gray" }) {
  const colors = {
    gray: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-800",
    yellow: "bg-amber-100 text-amber-700",
  };

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

export function extractError(err) {
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
