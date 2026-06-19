function escapeCsvValue(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function itemsToCsv(items, headers) {
  const rows = [
    headers.map(escapeCsvValue).join(","),
    ...items.map((item) =>
      [
        item.name,
        item.quantity,
        item.unit || "",
        item.category || "",
        item.estimated_price ?? "",
        item.status,
      ]
        .map(escapeCsvValue)
        .join(",")
    ),
  ];

  return rows.join("\n");
}
