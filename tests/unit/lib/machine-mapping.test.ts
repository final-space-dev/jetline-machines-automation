import { describe, it, expect } from "vitest";
import { matchesFilter, needingAttention, type XeroxMachine } from "@/lib/machine-mapping";

const machine = (over: Partial<XeroxMachine>): XeroxMachine => ({
  printer_id: 1,
  serial_number: "1",
  model: "Model",
  model_name: null,
  store: "Alberton",
  company_group: "Group",
  printer_type: "Colour",
  reporting_enabled: true,
  latest_reading_date: "2026-11-01",
  last_seen: null,
  bms_found: true,
  bms_active: true,
  bms_company: "Jetline Alberton",
  xerox_status: "Present",
  ...over,
});

describe("needingAttention", () => {
  it("is 0 when every machine is mapped, in BMS, active and on the Xerox file", () => {
    expect(needingAttention([machine({}), machine({ serial_number: "2" })])).toBe(0);
  });

  it("counts a machine once, however many warnings it has", () => {
    // Unmapped, not in BMS and missing from Xerox: three warning filters, one machine.
    const bad = machine({ store: null, company_group: null, bms_found: false, bms_active: null, bms_company: null, xerox_status: "Missing" });
    expect(matchesFilter(bad, "unmapped")).toBe(true);
    expect(matchesFilter(bad, "no_bms")).toBe(true);
    expect(matchesFilter(bad, "xerox_missing")).toBe(true);
    expect(needingAttention([bad, machine({})])).toBe(1);
  });

  it("never exceeds the number of machines", () => {
    const list = [1, 2, 3].map((n) => machine({ serial_number: String(n), store: null, company_group: null, bms_found: false, xerox_status: "Missing" }));
    expect(needingAttention(list)).toBe(3);
  });
});
