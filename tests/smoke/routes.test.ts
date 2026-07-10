import { describe, it, expect } from "vitest";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3003";

// Helper to check if server is running
async function checkServer(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

describe("API Routes Smoke Tests", () => {
  describe("Core API Endpoints", () => {
    it("GET /api/dashboard should return 200", async () => {
      const serverUp = await checkServer();
      if (!serverUp) {
        console.log("Server not running, skipping route test");
        return;
      }

      const response = await fetch(`${BASE_URL}/api/dashboard`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("summary");
    });

    it("GET /api/dashboard/insights should return 200", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/api/dashboard/insights`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("insights");
    });

    it("GET /api/machines should return 200 with pagination", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/api/machines?page=1&limit=10`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("machines");
      expect(data).toHaveProperty("pagination");
      expect(data.pagination).toHaveProperty("total");
      expect(data.pagination).toHaveProperty("page");
      expect(data.pagination).toHaveProperty("limit");
    });

    it("GET /api/companies should return 200", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/api/companies`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it("GET /api/categories should return 200", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/api/categories`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it("GET /api/sync should return 200", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/api/sync?limit=10`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("syncs");
    });

    it("GET /api/scenarios should return 200", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/api/scenarios`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it("GET /api/analytics/models should return 200", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/api/analytics/models`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it("GET /api/analytics/companies should return 200", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/api/analytics/companies`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe("Page Routes", () => {
    it("GET / (Dashboard) should return 200", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("GET /machines should return 200", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/machines`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("GET /contracts should return 200", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/contracts`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("GET /lift should return 200", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/lift`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("GET /sync should return 200", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/sync`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });

    it("GET /settings should return 200", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/settings`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    });
  });

  describe("Error Handling", () => {
    it("GET /api/machines/nonexistent should return 404", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/api/machines/nonexistent-id`);
      expect(response.status).toBe(404);
    });

    it("GET /api/companies/nonexistent should return 404", async () => {
      const serverUp = await checkServer();
      if (!serverUp) return;

      const response = await fetch(`${BASE_URL}/api/companies/nonexistent-id`);
      expect(response.status).toBe(404);
    });
  });
});
