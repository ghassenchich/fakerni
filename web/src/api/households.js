import client from "./client";

export function listHouseholds() {
  return client.get("/api/household/households/");
}

export function getHousehold(id) {
  return client.get(`/api/household/households/${id}/`);
}

export function createHousehold(name, type = "family") {
  return client.post("/api/household/households/", { name, type });
}

export function updateHousehold(id, data) {
  return client.patch(`/api/household/households/${id}/`, data);
}

export function deleteHousehold(id) {
  return client.delete(`/api/household/households/${id}/`);
}

export function joinHousehold(invite_code) {
  return client.post("/api/household/join/", { invite_code });
}

export function updateMemberRole(membershipId, role) {
  return client.post(`/api/household/members/${membershipId}/role/`, { role });
}

export function regenerateInvite(householdId) {
  return client.post(`/api/household/${householdId}/regenerate-invite/`);
}

export function listMembers(householdId) {
  return client.get(`/api/household/${householdId}/members/`);
}

export function removeMember(householdId, userId) {
  return client.delete(`/api/household/${householdId}/members/${userId}/`);
}

export function getBalances(householdId) {
  return client.get(`/api/household/${householdId}/balances/`);
}
