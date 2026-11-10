import { describe, it, expect } from "vitest";
import { NO_STORE, ownStoreOrNothing } from "@/lib/store-scope";

describe("ownStoreOrNothing", () => {
  it("is the person's own store when they have one", () => {
    expect(ownStoreOrNothing("Alberton")).toBe("Alberton");
  });
  it("is the name no store has when they have none", () => {
    expect(ownStoreOrNothing(null)).toBe(NO_STORE);
    expect(ownStoreOrNothing(undefined)).toBe(NO_STORE);
    expect(ownStoreOrNothing("")).toBe(NO_STORE);
  });
  it("is text Postgres accepts: no NUL or other control character", () => {
    // eslint-disable-next-line no-control-regex
    expect(/[\u0000-\u001f]/.test(NO_STORE)).toBe(false);
  });
});
