import { describe, it, expect } from "vitest";
import { getDueStatus } from "./dueStatus";

const hoursFromNow = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();

describe("getDueStatus", () => {
  it("returns null when there is no due date", () => {
    expect(getDueStatus({ status: "active" })).toBeNull();
  });

  it("returns null for non-active fakras even if overdue", () => {
    expect(getDueStatus({ status: "archived", due_date: hoursFromNow(-10) })).toBeNull();
  });

  it("flags overdue when the due date is in the past", () => {
    expect(getDueStatus({ status: "active", due_date: hoursFromNow(-1) })).toBe("overdue");
  });

  it("flags dueSoon within the 24h window", () => {
    expect(getDueStatus({ status: "active", due_date: hoursFromNow(5) })).toBe("dueSoon");
  });

  it("returns null when due far in the future", () => {
    expect(getDueStatus({ status: "active", due_date: hoursFromNow(72) })).toBeNull();
  });
});
