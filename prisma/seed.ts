import "dotenv/config";
import { hashPassword } from "../src/lib/password.js";
import { prisma } from "../src/lib/prisma.js";

// Makes one admin user for development: npm run db:seed
// The email and the password come from .env, so no password is in the code.
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env to make an admin user.");
    return;
  }

  const passwordHash = await hashPassword(password);
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "admin", passwordHash },
    create: { name: "Admin", email, passwordHash, role: "admin", tier: "enterprise" },
  });
  console.log(`Admin user is ready: ${admin.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
