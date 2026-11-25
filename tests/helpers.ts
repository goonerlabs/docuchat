import { prisma } from "../src/lib/prisma.js";

// Empty each table. Deleting the users also deletes their rows in the other tables (cascade).
export async function resetDatabase() {
  await prisma.user.deleteMany();
}

// A listener runs after the response. Wait until its result is in the database.
export async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  const end = Date.now() + 3000;
  for (;;) {
    const value = await read();
    if (done(value) || Date.now() > end) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
