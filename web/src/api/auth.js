import client from "./client";

export function register(email, password) {
  return client.post("/api/register/", { email, password });
}

export function login(email, password) {
  return client.post("/api/token/", { email, password });
}

export function requestPasswordReset(email) {
  return client.post("/api/password-reset/request/", { email });
}

export function confirmPasswordReset(email, code, new_password) {
  return client.post("/api/password-reset/confirm/", { email, code, new_password });
}
