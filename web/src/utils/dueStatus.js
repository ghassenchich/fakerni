// Matches the backend's FAKRA_REMINDER_WINDOW_HOURS default (see
// fakerni/settings.py and fakras/reminders.py).
const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

// Returns "overdue" | "dueSoon" | null for an active Fakra based on its
// due_date, or null if the Fakra has no due date, isn't active, or isn't
// due soon/overdue.
export function getDueStatus(fakra) {
  if (!fakra.due_date || fakra.status !== "active") return null;

  const due = new Date(fakra.due_date).getTime();
  const now = Date.now();

  if (due < now) return "overdue";
  if (due - now <= DUE_SOON_WINDOW_MS) return "dueSoon";
  return null;
}
