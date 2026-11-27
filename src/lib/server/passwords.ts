/** Password hashing with bcrypt (cost 10), via the pure-JS bcryptjs. */
import bcrypt from "bcryptjs";

const BCRYPT_COST = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Compared against when the email is unknown, so login takes the same time
 * whether or not the account exists. It matches no real password.
 */
export function dummyPasswordHash(): string {
  return bcrypt.hashSync("no-account-with-this-email", BCRYPT_COST);
}
