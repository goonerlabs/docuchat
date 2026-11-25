import { defineConfig } from "vitest/config";

// The tests use their own database (docuchat_test), so they never delete development data.
// These values are for tests only. They are not real secrets.
export default defineConfig({
  test: {
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://docuchat:docuchat@localhost:5442/docuchat_test",
      JWT_ACCESS_SECRET: "test-access-secret-test-access-secret-0001",
      JWT_REFRESH_SECRET: "test-refresh-secret-test-refresh-secret-002",
      JWT_EXPIRES_IN: "15m",
      REFRESH_TOKEN_EXPIRES_IN: "7d",
    },
  },
});
