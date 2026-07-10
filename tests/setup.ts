import { beforeAll, afterAll, afterEach } from "vitest";

// Global test setup
beforeAll(() => {
  // Set test environment variables (use Object.defineProperty to avoid TS readonly error)
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/jetline_test";
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3003";
  }
});

afterEach(() => {
  // Clean up after each test
});

afterAll(() => {
  // Global cleanup
});
