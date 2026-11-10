import { describe, it, expect } from "vitest";
import { count, num, present } from "@/lib/numbers";

describe("num", () => {
  it("coerces the strings Postgres sends for bigint columns", () => {
    expect(num("2235950")).toBe(2235950);
    expect(num("2235950") - num("2234162")).toBe(1788);
  });
  it("is 0 for what is not a number", () => {
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num("")).toBe(0);
    expect(num("abc")).toBe(0);
    expect(num(Infinity)).toBe(0);
  });
  it("keeps numbers as they are", () => {
    expect(num(42)).toBe(42);
    expect(num(0)).toBe(0);
  });
});

describe("present", () => {
  it("tells a reading of 0 from no reading", () => {
    expect(present(0)).toBe(true);
    expect(present("0")).toBe(true);
    expect(present(null)).toBe(false);
    expect(present(undefined)).toBe(false);
  });
});

describe("count", () => {
  it("groups thousands, from a number or a string", () => {
    expect(count(2235950).replace(/\s/g, " ")).toBe("2 235 950");
    expect(count("177500").replace(/\s/g, " ")).toBe("177 500");
    expect(count(0)).toBe("0");
  });
  it("shows a dash when there is no value", () => {
    expect(count(null)).toBe("—");
    expect(count(undefined)).toBe("—");
    expect(count("abc")).toBe("—");
  });
});
