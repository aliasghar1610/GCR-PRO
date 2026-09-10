import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Application-level encryption for the Google OAuth tokens on the User row.
 *
 * A Google refresh token is a long-lived master key to the granted scopes, so
 * it must not sit in the database as readable text — a leaked backup, a stray
 * `SELECT`, or a compromised read-only DB credential would otherwise hand an
 * attacker live access to every user's Google account.
 *
 * AES-256-GCM (authenticated) with a random 96-bit IV per value. Stored as
 * `v1:<iv>:<authTag>:<ciphertext>`, all base64url.
 */

const PREFIX = "v1";
const IV_BYTES = 12;

function key(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set — generate one with: openssl rand -base64 32"
    );
  }
  const parsed = Buffer.from(raw, "base64");
  if (parsed.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32)");
  }
  return parsed;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    PREFIX,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

/**
 * Returns null when the value can't be authenticated — a tampered or
 * key-mismatched row is treated as "no usable token" (forcing re-auth) rather
 * than throwing into a request handler.
 */
export function decryptToken(stored: string): string | null {
  // Rows written before token encryption existed are plaintext. They are
  // re-encrypted the next time Google issues a token for that user; this
  // branch can be deleted once no legacy rows remain.
  if (!stored.startsWith(`${PREFIX}:`)) return stored;

  const [, ivPart, tagPart, dataPart] = stored.split(":");
  if (!ivPart || !tagPart || !dataPart) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function encryptOptionalToken(plaintext: string | null | undefined): string | undefined {
  return plaintext ? encryptToken(plaintext) : undefined;
}
