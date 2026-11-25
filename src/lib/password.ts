import bcrypt from "bcryptjs";

// Each round doubles the work. 12 rounds is about 250 ms: slow for an attacker, fast enough for a user.
const SALT_ROUNDS = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

// bcrypt.compare takes the same time for each wrong password, so the time tells an attacker nothing.
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

// A hash of a random value. Login compares against it when the email is unknown,
// so "unknown email" and "wrong password" take the same time.
export const DUMMY_HASH = bcrypt.hashSync(crypto.randomUUID(), SALT_ROUNDS);
