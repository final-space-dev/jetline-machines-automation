import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests (tests/e2e). Two ways to run them:
 *
 *   npm run test:e2e
 *     against a local server on port 3003 (started here with `npm run start`,
 *     so build first). Only the signed-out tests run unless the sign-in
 *     variables below are set.
 *
 *   E2E_BASE_URL=https://jetline-machines-dev.vercel.app \
 *   E2E_BYPASS_FILE=<file holding the dev project's protection bypass token> \
 *   E2E_EMAIL=dev-admin@jetline.local E2E_PASSWORD_FILE=<file holding its password> \
 *   npm run test:e2e
 *     against the dev address (docs/DEV-ENVIRONMENT.md). Never point this at
 *     production: the journey signs in and clicks through real screens.
 *
 * E2E_CHROME names a Chromium to use when the one this Playwright version
 * wants is not downloaded.
 */
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3003";
const bypass = process.env.E2E_BYPASS_FILE ? readFileSync(process.env.E2E_BYPASS_FILE, "utf8").trim() : null;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "off",
    screenshot: "off",
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" } : undefined,
    launchOptions: process.env.E2E_CHROME ? { executablePath: process.env.E2E_CHROME } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run start", url: "http://localhost:3003", reuseExistingServer: true, timeout: 120 * 1000 },
});
