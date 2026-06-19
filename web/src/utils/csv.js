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

export function downloadCsv(filename, csvContent) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
