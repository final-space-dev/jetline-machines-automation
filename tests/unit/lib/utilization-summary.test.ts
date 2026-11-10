import { describe, it, expect } from "vitest";
import { hasReadings, summariseUtilization } from "@/lib/utilization-summary";

const machine = (percent: number, status: string, liftScore: number, days: number | null) => ({
  utilizationPercent: percent,
  utilizationStatus: status,
  liftScore,
  daysSinceLastReading: days,
});

describe("summariseUtilization", () => {
  it("is null when the route answered for no machine", () => {
    expect(summariseUtilization([])).toBeNull();
    expect(summariseUtilization([undefined, null])).toBeNull();
  });

  it("counts bands, lift candidates and the average over machines with readings", () => {
    const s = summariseUtilization([machine(10, "critical", 80, 2), machine(60, "optimal", 40, 1), machine(110, "overworked", 30, 0)]);
    expect(s).toMatchObject({ total: 3, critical: 1, low: 0, optimal: 1, high: 0, overworked: 1, liftCandidates: 1, avgUtilization: 60, noReadings: 0 });
  });

  it("keeps a machine that has never sent a reading out of Critical, the lift candidates and the average", () => {
    const s = summariseUtilization([machine(0, "critical", 80, null), machine(50, "optimal", 40, 3)]);
    expect(s).toMatchObject({ total: 1, critical: 0, optimal: 1, liftCandidates: 0, avgUtilization: 50, noReadings: 1 });
  });

  it("says so when no machine has a reading: nothing is critical", () => {
    const s = summariseUtilization([machine(0, "critical", 80, null), machine(0, "critical", 80, null)]);
    expect(s).toMatchObject({ total: 0, critical: 0, liftCandidates: 0, avgUtilization: 0, noReadings: 2 });
  });
});

describe("hasReadings", () => {
  it("is false for a missing answer and for a machine with no reading", () => {
    expect(hasReadings(undefined)).toBe(false);
    expect(hasReadings(machine(0, "critical", 80, null))).toBe(false);
    expect(hasReadings(machine(0, "critical", 80, 0))).toBe(true);
  });
});
