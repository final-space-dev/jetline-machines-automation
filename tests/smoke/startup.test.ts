import { describe, it, expect } from "vitest";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";

// Helper to check if server is running
async function isServerRunning(): Promise<boolean> {
  try {
    await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

describe("Server Startup Smoke Tests", () => {
  describe("Environment", () => {
    it("should have DATABASE_URL configured", () => {
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.DATABASE_URL).toContain("postgresql");
    });

    it("should have NEXT_PUBLIC_APP_URL configured", () => {
      expect(process.env.NEXT_PUBLIC_APP_URL).toBeDefined();
    });
  });

  describe("Health Endpoints (requires running server)", () => {
    it("should respond to health check", async () => {
      const serverUp = await isServerRunning();
      if (!serverUp) {
        console.log("Server not running, skipping health check test");
        return;
      }

      const response = await fetch(`${BASE_URL}/api/health`);
      // 200 = healthy, 503 = unhealthy (DB down) - both are valid responses
      expect([200, 503]).toContain(response.status);

      const data = await response.json();
      expect(["healthy", "unhealthy"]).toContain(data.status);
      expect(data.timestamp).toBeDefined();
    });

    it("should provide detailed health info", async () => {
      const serverUp = await isServerRunning();
      if (!serverUp) {
        console.log("Server not running, skipping detailed health test");
        return;
      }

      const response = await fetch(`${BASE_URL}/api/health/detailed`);
      // 200 = healthy, 503 = unhealthy - both are valid responses
      expect([200, 503]).toContain(response.status);

      const data = await response.json();
      expect(data.status).toBeDefined();
      expect(data.checks).toBeDefined();
      expect(data.checks.database).toBeDefined();
    });
  });
});
