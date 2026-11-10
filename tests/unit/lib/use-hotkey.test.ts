import { describe, it, expect } from "vitest";
import { overlayOpen } from "@/lib/use-hotkey";

const page = (open: string | null) => ({
  querySelector: (selector: string) => (open && selector.includes(open) ? ({} as Element) : null),
});

describe("overlayOpen", () => {
  it("is false on a page with nothing open, so Escape may leave the page", () => {
    expect(overlayOpen(page(null))).toBe(false);
  });
  it("is true while a dialog, a confirm, a list or a popover is open, so Escape only closes it", () => {
    expect(overlayOpen(page('[role="dialog"]'))).toBe(true);
    expect(overlayOpen(page('[role="alertdialog"]'))).toBe(true);
    expect(overlayOpen(page('[role="listbox"]'))).toBe(true);
    expect(overlayOpen(page('[data-slot="popover-content"]'))).toBe(true);
  });
  it("is false where there is no document at all", () => {
    expect(overlayOpen(undefined)).toBe(false);
  });
});
