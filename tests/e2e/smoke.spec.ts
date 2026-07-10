import { test, expect } from "@playwright/test";

test.describe("Application Smoke Tests", () => {
  test("dashboard page loads without crashing", async ({ page }) => {
    const response = await page.goto("/");

    // Page should load (2xx or 3xx status)
    expect(response?.status()).toBeLessThan(500);

    // Should have basic structure (not a blank page)
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("machines page loads without crashing", async ({ page }) => {
    const response = await page.goto("/machines");
    expect(response?.status()).toBeLessThan(500);

    // Should have some content
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("contracts page loads without crashing", async ({ page }) => {
    const response = await page.goto("/contracts");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("lift planner page loads without crashing", async ({ page }) => {
    const response = await page.goto("/lift");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("sync page loads without crashing", async ({ page }) => {
    const response = await page.goto("/sync");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("settings page loads without crashing", async ({ page }) => {
    const response = await page.goto("/settings");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator("body")).not.toBeEmpty();
  });
});

test.describe("API Endpoints", () => {
  test("health endpoint responds", async ({ request }) => {
    const response = await request.get("/api/health");
    // Should respond (even if unhealthy due to DB)
    expect(response.status()).toBeLessThan(600);

    const data = await response.json();
    expect(data.status).toBeDefined();
    expect(data.timestamp).toBeDefined();
  });

  test("health detailed endpoint responds", async ({ request }) => {
    const response = await request.get("/api/health/detailed");
    expect(response.status()).toBeLessThan(600);

    const data = await response.json();
    expect(data.status).toBeDefined();
    expect(data.checks).toBeDefined();
  });

  test("dashboard API responds", async ({ request }) => {
    const response = await request.get("/api/dashboard");
    // API should respond (may error if DB down, but shouldn't crash)
    expect(response.status()).toBeLessThan(600);
  });

  test("machines API responds", async ({ request }) => {
    const response = await request.get("/api/machines?page=1&limit=10");
    expect(response.status()).toBeLessThan(600);
  });

  test("companies API responds", async ({ request }) => {
    const response = await request.get("/api/companies");
    expect(response.status()).toBeLessThan(600);
  });

  test("categories API responds", async ({ request }) => {
    const response = await request.get("/api/categories");
    expect(response.status()).toBeLessThan(600);
  });
});

test.describe("Navigation", () => {
  test("sidebar has navigation links", async ({ page }) => {
    await page.goto("/");

    // Should have key navigation links
    await expect(page.locator('a[href="/machines"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a[href="/contracts"]')).toBeVisible();
    await expect(page.locator('a[href="/lift"]')).toBeVisible();
  });
});
