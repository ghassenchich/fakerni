import client from "./client";

export function getProfile() {
  return client.get("/api/users/me/");
}

export function updateProfile(data) {
  return client.patch("/api/users/me/", data);
}

export function changePassword(old_password, new_password) {
  return client.post("/api/users/me/change-password/", { old_password, new_password });
}
