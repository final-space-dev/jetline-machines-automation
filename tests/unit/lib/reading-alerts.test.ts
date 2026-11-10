import { describe, it, expect } from "vitest";
import { onePerSerial, readingAlerts } from "@/lib/reading-alerts";

const today = new Date("2026-11-10T08:00:00Z");
const record = (serial: string, latest: string | null, model = "PrimeLink C9275", store: string | null = "Bedfordview") => ({
  serial_number: serial,
  model,
  store,
  latest_date: latest,
});

describe("readingAlerts", () => {
  it("raises nothing for a machine that read yesterday under its newer record", () => {
    // The case that showed "Critical, 208 days ago" on Operations for a machine that had read the day before.
    const alerts = readingAlerts(
      [record("3050234575", "2026-04-16", "PrimeLink C9275 with Xerox EX C9275 Print Server"), record("3050234575", "2026-11-09")],
      today,
    );
    expect(alerts).toEqual([]);
  });

  it("calls a machine stale over 14 days and critical over 30, by its newest reading", () => {
    const alerts = readingAlerts([record("A", "2026-10-26"), record("B", "2026-10-10"), record("C", "2026-10-27"), record("D", "2026-10-11")], today);
    expect(alerts.map((a) => [a.serial_number, a.type, a.days_since])).toEqual([
      ["B", "critical", 31],
      ["D", "stale", 30],
      ["A", "stale", 15],
    ]);
    expect(alerts[0].detail).toBe("Last reading 31 days ago");
  });

  it("lists a machine that has never read first, once, whatever number of records it has", () => {
    const alerts = readingAlerts([record("N", null), record("N", null, "Other record"), record("B", "2026-01-01")], today);
    expect(alerts.map((a) => [a.serial_number, a.type])).toEqual([["N", "never_reported"], ["B", "critical"]]);
    expect(alerts[0].detail).toBe("Never sent a reading");
  });

  it("does not call a machine never-read when one of its records has a reading", () => {
    expect(readingAlerts([record("X", null), record("X", "2026-11-09")], today)).toEqual([]);
  });

  it("keeps to the limit", () => {
    const many = Array.from({ length: 60 }, (_, i) => record(`S${i}`, "2026-01-01"));
    expect(readingAlerts(many, today)).toHaveLength(50);
  });
});

describe("onePerSerial", () => {
  it("keeps the record seen most recently for each serial", () => {
    const rows = [
      { serial_number: "1", last_seen: "2026-06-21", model: "old" },
      { serial_number: "1", last_seen: "2026-11-09", model: "new" },
      { serial_number: "2", last_seen: null, model: "only" },
    ];
    expect(onePerSerial(rows).map((r) => r.model)).toEqual(["new", "only"]);
  });
});
