import { execSync } from "node:child_process";

// Runs one time before the tests: apply all migrations to the test database.
export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://docuchat:docuchat@localhost:5442/docuchat_test";
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
