import { createHash, randomBytes } from "node:crypto";

/**
 * Generates a high-entropy 256-bit (32-byte) URL-safe token.
 * Raw token is returned ONCE to the customer / email handler; only its
 * SHA-256 hex digest is persisted in `booking_tokens.token_hash`.
 */
export function generateBookingToken(): {
  rawToken: string;
  tokenHash: string;
} {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashBookingToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Computes the deterministic SHA-256 hex digest (64 chars) of a raw token.
 */
export function hashBookingToken(rawToken: string): string {
  return createHash("sha256").update(rawToken.trim(), "utf8").digest("hex");
}

/**
 * Generates a non-predictable, human-readable booking reference code,
 * e.g. `MAP-20261022-8F3K9Q`.
 */
export function generateBookingReference(appointmentDate: string): string {
  const compactDate = appointmentDate.replace(/-/g, "");
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `MAP-${compactDate}-${suffix}`;
}
