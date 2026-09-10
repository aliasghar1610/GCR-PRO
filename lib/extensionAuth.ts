import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { createHash } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TOKEN_TTL = "30d";
const ALGORITHM = "HS256";

/**
 * Deliberately NOT NEXTAUTH_SECRET. These are two different credential
 * systems with different lifetimes and blast radii — a leaked extension key
 * must not also forge web sessions, and vice versa.
 */
function secretKey() {
  const secret = process.env.EXTENSION_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "EXTENSION_JWT_SECRET must be set to at least 32 characters (openssl rand -base64 32)"
    );
  }
  return new TextEncoder().encode(secret);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a new extension bearer token for a user and stores its hash on the
 * User row. Storing the hash (not the token) means issuing a fresh token
 * automatically revokes any previous one — the old token's hash no longer
 * matches, so verifyExtensionToken rejects it (5.5.1).
 */
export async function issueExtensionToken(userId: string): Promise<string> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secretKey());

  await prisma.user.update({
    where: { id: userId },
    data: { extensionTokenHash: hashToken(token), extensionTokenIssuedAt: new Date() },
  });

  return token;
}

/** Clears the stored hash so any outstanding extension token stops working. */
export async function revokeExtensionToken(userId: string): Promise<void> {
  // updateMany, not update: a stale session whose User row is already gone
  // would make update() throw P2025 instead of quietly affecting no rows.
  await prisma.user.updateMany({
    where: { id: userId },
    data: { extensionTokenHash: null, extensionTokenIssuedAt: null },
  });
}

async function verifyExtensionToken(token: string): Promise<string | null> {
  let userId: string | undefined;
  try {
    // `algorithms` pins verification to the one algorithm we issue with, so a
    // token whose header advertises anything else is rejected before the
    // signature is even considered.
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALGORITHM] });
    if (typeof payload.sub !== "string") return null;
    userId = payload.sub;
  } catch {
    return null; // expired, malformed, wrong alg, or bad signature
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { extensionTokenHash: true },
  });
  if (!user?.extensionTokenHash || user.extensionTokenHash !== hashToken(token)) {
    return null; // revoked or superseded by a newer token
  }
  return userId;
}

/**
 * Resolves the acting user id for a route the extension can also call: tries
 * the normal NextAuth session first (web app), then falls back to a Bearer
 * extension token (spec 5.5.4).
 */
export async function resolveUserId(req: Request): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session.user.id;

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  return verifyExtensionToken(token);
}
