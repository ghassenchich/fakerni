import { describe, it, expect } from "vitest";
import { itemsToCsv } from "./csv";

const HEADERS = ["Name", "Qty", "Unit", "Category", "Price", "Status"];

describe("itemsToCsv", () => {
  it("renders a header row and one row per item", () => {
    const csv = itemsToCsv(
      [{ name: "Milk", quantity: 2, unit: "L", category: "Dairy", estimated_price: 2.5, status: "pending" }],
      HEADERS
    );
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Name,Qty,Unit,Category,Price,Status");
    expect(lines[1]).toBe("Milk,2,L,Dairy,2.5,pending");
  });

  it("quotes values containing commas, quotes, or newlines", () => {
    const csv = itemsToCsv(
      [{ name: 'Rice, "basmati"', quantity: 1, unit: "", category: "", estimated_price: null, status: "done" }],
      HEADERS
    );
    // comma + embedded quotes -> wrapped in quotes with doubled inner quotes
    expect(csv.split("\n")[1]).toBe('"Rice, ""basmati""",1,,,,done');
  });

  it("renders empty strings for missing optional fields", () => {
    const csv = itemsToCsv(
      [{ name: "Eggs", quantity: 12, status: "pending" }],
      HEADERS
    );
    expect(csv.split("\n")[1]).toBe("Eggs,12,,,,pending");
  });
});
