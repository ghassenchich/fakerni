const listeners = new Set();

export function onLogout(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitLogout() {
  listeners.forEach((listener) => listener());
}
