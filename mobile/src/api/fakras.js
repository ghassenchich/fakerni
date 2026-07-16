import client from "./client";

export function listFakras(params = {}) {
  return client.get("/api/fakras/", { params });
}

export function getFakra(id) {
  return client.get(`/api/fakras/${id}/`);
}

export function createFakra(data) {
  return client.post("/api/fakras/", data);
}

export function updateFakra(id, data) {
  return client.patch(`/api/fakras/${id}/`, data);
}

export function deleteFakra(id) {
  return client.delete(`/api/fakras/${id}/`);
}

export function archiveFakra(id) {
  return client.post(`/api/fakras/${id}/archive/`);
}

export function getActivity(id) {
  return client.get(`/api/fakras/${id}/activity/`);
}

export function duplicateFakra(id) {
  return client.post(`/api/fakras/${id}/duplicate/`);
}

export function getSpendingAnalytics(params = {}) {
  return client.get("/api/fakras/analytics/spending/", { params });
}

export function getSpendingDigest() {
  return client.get("/api/fakras/analytics/digest/");
}

export function getRestockSuggestions() {
  return client.get("/api/fakras/restock-suggestions/");
}

export function checkPrice(name, price) {
  return client.post("/api/fakras/price-check/", { name, price });
}

export function getCategorysuggestions() {
  return client.get("/api/fakras/categories/");
}

export function shareFakra(id, user_ids) {
  return client.post(`/api/fakras/${id}/share/`, { user_ids });
}

export function listItems(fakraId, params = {}) {
  return client.get(`/api/fakras/${fakraId}/items/`, { params });
}

export function createItem(fakraId, data) {
  return client.post(`/api/fakras/${fakraId}/items/`, data);
}

export function smartAddItems(fakraId, text) {
  return client.post(`/api/fakras/${fakraId}/items/smart-add/`, { text });
}

export function smartScanItems(fakraId, asset) {
  const formData = new FormData();
  formData.append("image", {
    uri: asset.uri,
    name: asset.fileName || "photo.jpg",
    type: asset.mimeType || "image/jpeg",
  });
  return client.post(`/api/fakras/${fakraId}/items/smart-scan/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function getSuggestions(fakraId) {
  return client.get(`/api/fakras/${fakraId}/items/suggestions/`);
}

export function smartCommand(fakraId, text) {
  return client.post(`/api/fakras/${fakraId}/items/smart-command/`, { text });
}

export function updateItem(fakraId, itemId, data) {
  return client.patch(`/api/fakras/${fakraId}/items/${itemId}/`, data);
}

export function deleteItem(fakraId, itemId) {
  return client.delete(`/api/fakras/${fakraId}/items/${itemId}/`);
}

export function markItemDone(fakraId, itemId) {
  return client.post(`/api/fakras/${fakraId}/items/${itemId}/done/`);
}

export function undoItem(fakraId, itemId) {
  return client.post(`/api/fakras/${fakraId}/items/${itemId}/undo/`);
}

export function listAttachments(fakraId, itemId) {
  return client.get(`/api/fakras/${fakraId}/items/${itemId}/attachments/`);
}

export function uploadAttachment(fakraId, itemId, asset) {
  const formData = new FormData();
  formData.append("file", {
    uri: asset.uri,
    name: asset.fileName || "photo.jpg",
    type: asset.mimeType || "image/jpeg",
  });
  return client.post(`/api/fakras/${fakraId}/items/${itemId}/attachments/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function deleteAttachment(fakraId, itemId, attachmentId) {
  return client.delete(`/api/fakras/${fakraId}/items/${itemId}/attachments/${attachmentId}/`);
}
