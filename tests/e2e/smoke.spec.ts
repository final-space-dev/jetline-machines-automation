import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

/**
 * What a person meets: signed out, then (when a sign-in is supplied) a walk
 * through the main screens as an admin. See playwright.config.ts for how to
 * run it. The walk reads; it writes nothing.
 */

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD_FILE ? readFileSync(process.env.E2E_PASSWORD_FILE, "utf8").trim() : null;

/** Every request that answered 5xx while a test ran: the test fails on any. */
function watchForServerErrors(page: Page): string[] {
  const failures: string[] = [];
  page.on("response", (r) => {
    if (r.status() >= 500) failures.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  page.on("pageerror", (e) => failures.push(`page error: ${e.message}`));
  return failures;
}

test.describe("Signed out", () => {
  test("the start page sends a visitor to sign in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("a wrong password is refused with a message", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "nobody@jetline.local");
    await page.fill("#password", "not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("a data route refuses a visitor", async ({ request }) => {
    const res = await request.get("/api/equipment/all-stores", { maxRedirects: 0 });
    expect([301, 302, 307, 308, 401, 403]).toContain(res.status());
  });
});

test.describe("Signed in as an admin", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD_FILE to run the signed-in walk");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", email!);
    await page.fill("#password", password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  });

  test("all stores, then a store and its three tabs", async ({ page }) => {
    const failures = watchForServerErrors(page);
    await page.goto("/equipment");
    await expect(page.getByRole("heading", { name: "Equipment" })).toBeVisible();
    await expect(page.getByText("Total items")).toBeVisible();

    await page.goto("/equipment/stores/Alberton");
    await expect(page.getByRole("heading", { name: "Alberton" })).toBeVisible();
    await page.getByRole("tab", { name: /Printers/ }).first().click();
    await expect(page.getByRole("columnheader", { name: "Serial" })).toBeVisible();
    await page.getByRole("tab", { name: "Printer performance" }).click();
    await expect(page.getByText("Print volumes")).toBeVisible();
    expect(failures).toEqual([]);
  });

  test("fleet health, operations and activity", async ({ page }) => {
    const failures = watchForServerErrors(page);
    await page.goto("/equipment/fleet");
    await expect(page.getByRole("heading", { name: "Fleet health" })).toBeVisible();
    await expect(page.getByText("Condition breakdown")).toBeVisible();

    await page.goto("/operations");
    await expect(page.getByRole("heading", { name: "Operations" })).toBeVisible();
    await expect(page.getByText("Reading health")).toBeVisible();

    await page.goto("/activity");
    await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
    expect(failures).toEqual([]);
  });

  test("machine reports: every tab loads rows", async ({ page }) => {
    const failures = watchForServerErrors(page);
    await page.goto("/machine-reports");
    await expect(page.getByRole("heading", { name: "Machine reports" })).toBeVisible();
    for (const tab of ["Summary", "Month to date", "Weekly", "Monthly (6m)", "Year to date", "Machine status"]) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.getByText(/\d+ (of \d+ )?machines/)).toBeVisible({ timeout: 30_000 });
    }
    expect(failures).toEqual([]);
  });

  test("config: every tab opens", async ({ page }) => {
    const failures = watchForServerErrors(page);
    await page.goto("/setup");
    await expect(page.getByRole("heading", { name: "Config" })).toBeVisible();
    for (const tab of ["Stores", "Machine mapping", "Import", "Models", "Suppliers", "Equipment types", "Conditions", "Users", "Recently deleted"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveAttribute("aria-selected", "true");
      await page.waitForLoadState("networkidle");
    }
    expect(failures).toEqual([]);
  });

  test("the search finds a store and opens it", async ({ page }) => {
    await page.goto("/equipment");
    await page.keyboard.press("Control+k");
    await page.getByLabel("Search").fill("alberton");
    await page.getByRole("button", { name: /Alberton/ }).first().click();
    await expect(page).toHaveURL(/\/equipment\/stores\/Alberton/);
  });
});
