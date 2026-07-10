import { describe, it, expect } from "vitest";
import {
  formatNumber,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercentage,
  getStatusVariant,
  getStatusColor,
  getCategoryColor,
  getContractStatusColor,
  getContractBadgeVariant,
} from "@/lib/utils";

describe("Formatting Utilities", () => {
  describe("formatNumber", () => {
    it("formats numbers with thousands separator", () => {
      expect(formatNumber(1000)).toContain("000");
      expect(formatNumber(1234567)).toContain("234");
    });

    it("returns dash for null/undefined", () => {
      expect(formatNumber(null)).toBe("-");
      expect(formatNumber(undefined)).toBe("-");
    });

    it("handles zero", () => {
      expect(formatNumber(0)).toBe("0");
    });
  });

  describe("formatCurrency", () => {
    it("formats as ZAR currency", () => {
      const result = formatCurrency(1000);
      expect(result).toContain("1");
      expect(result).toContain("000");
    });

    it("returns dash for null/undefined", () => {
      expect(formatCurrency(null)).toBe("-");
      expect(formatCurrency(undefined)).toBe("-");
    });
  });

  describe("formatDate", () => {
    it("formats Date objects", () => {
      const date = new Date("2024-06-15");
      const result = formatDate(date);
      expect(result).toContain("2024");
      expect(result).toContain("15");
    });

    it("formats date strings", () => {
      const result = formatDate("2024-06-15");
      expect(result).toContain("2024");
    });

    it("returns dash for null/undefined", () => {
      expect(formatDate(null)).toBe("-");
      expect(formatDate(undefined)).toBe("-");
    });
  });

  describe("formatDateTime", () => {
    it("includes time in output", () => {
      const date = new Date("2024-06-15T14:30:00");
      const result = formatDateTime(date);
      expect(result).toContain("2024");
    });

    it("returns dash for null/undefined", () => {
      expect(formatDateTime(null)).toBe("-");
    });
  });

  describe("formatPercentage", () => {
    it("formats as percentage with default decimal", () => {
      expect(formatPercentage(50.5)).toBe("50.5%");
      expect(formatPercentage(100)).toBe("100.0%");
    });

    it("respects custom decimals", () => {
      expect(formatPercentage(50.556, 2)).toBe("50.56%");
    });

    it("returns dash for null/undefined", () => {
      expect(formatPercentage(null)).toBe("-");
      expect(formatPercentage(undefined)).toBe("-");
    });
  });
});

describe("Status Utilities", () => {
  describe("getStatusVariant", () => {
    it("returns correct variants for each status", () => {
      expect(getStatusVariant("ACTIVE")).toBe("default");
      expect(getStatusVariant("INACTIVE")).toBe("secondary");
      expect(getStatusVariant("MAINTENANCE")).toBe("outline");
      expect(getStatusVariant("DECOMMISSIONED")).toBe("destructive");
    });
  });

  describe("getStatusColor", () => {
    it("returns correct colors for each status", () => {
      expect(getStatusColor("ACTIVE")).toContain("green");
      expect(getStatusColor("INACTIVE")).toContain("yellow");
      expect(getStatusColor("MAINTENANCE")).toContain("blue");
      expect(getStatusColor("DECOMMISSIONED")).toContain("red");
    });
  });

  describe("getCategoryColor", () => {
    it("returns correct colors for categories", () => {
      expect(getCategoryColor("Colour")).toContain("blue");
      expect(getCategoryColor("Black and White")).toContain("gray");
      expect(getCategoryColor("Plan")).toContain("purple");
      expect(getCategoryColor("Office Machine")).toContain("green");
    });

    it("returns fallback for unknown categories", () => {
      expect(getCategoryColor("Unknown")).toContain("gray");
    });
  });

  describe("getContractStatusColor", () => {
    it("returns red for expired contracts", () => {
      expect(getContractStatusColor(0)).toContain("red");
      expect(getContractStatusColor(-1)).toContain("red");
    });

    it("returns red for contracts expiring soon (<=3 months)", () => {
      expect(getContractStatusColor(1)).toContain("red");
      expect(getContractStatusColor(3)).toContain("red");
    });

    it("returns yellow for contracts expiring within a year", () => {
      expect(getContractStatusColor(6)).toContain("yellow");
      expect(getContractStatusColor(12)).toContain("yellow");
    });

    it("returns green for contracts with >12 months", () => {
      expect(getContractStatusColor(24)).toContain("green");
    });

    it("returns muted for null", () => {
      expect(getContractStatusColor(null)).toContain("muted");
    });
  });

  describe("getContractBadgeVariant", () => {
    it("returns destructive for soon-expiring", () => {
      expect(getContractBadgeVariant(0)).toBe("destructive");
      expect(getContractBadgeVariant(3)).toBe("destructive");
    });

    it("returns outline for expiring within a year", () => {
      expect(getContractBadgeVariant(6)).toBe("outline");
      expect(getContractBadgeVariant(12)).toBe("outline");
    });

    it("returns secondary for healthy contracts", () => {
      expect(getContractBadgeVariant(24)).toBe("secondary");
    });

    it("returns outline for null", () => {
      expect(getContractBadgeVariant(null)).toBe("outline");
    });
  });
});
