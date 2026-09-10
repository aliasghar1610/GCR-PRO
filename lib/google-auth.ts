import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";

/** Thrown when Google access can't be refreshed and the user must sign in again (6.6). */
export class ReauthRequiredError extends Error {
  constructor() {
    super("Google access was revoked — please sign in again.");
    this.name = "ReauthRequiredError";
  }
}

/**
 * True for a Google API error that only a fresh sign-in can fix: a
 * revoked/expired refresh token (invalid_grant), or a token that's valid but
 * was issued before a scope this call needs was added to lib/auth.ts's
 * SCOPES — Google won't grant new scopes to an existing token without the
 * user re-consenting, so it fails with "insufficient authentication scopes"
 * instead of a token error.
 */
export function isReauthRequiredError(err: unknown): boolean {
  if (err instanceof ReauthRequiredError) return true;
  const gaxiosError = err as { response?: { data?: { error?: string } }; message?: string };
  return (
    gaxiosError?.response?.data?.error === "invalid_grant" ||
    gaxiosError?.message?.includes("invalid_grant") === true ||
    gaxiosError?.message?.includes("insufficient authentication scopes") === true
  );
}

export async function clearStoredGoogleTokens(userId: string): Promise<void> {
  // updateMany instead of update: if the user row is already gone (the
  // exact stale-session case this is usually called for), update() would
  // throw P2025 "record not found" — updateMany just affects zero rows.
  await prisma.user.updateMany({
    where: { id: userId },
    data: { accessToken: null, refreshToken: null },
  });
}

/**
 * Builds an authenticated OAuth2Client for a user's stored Google tokens.
 * The client refreshes the access token on demand using the refresh token;
 * the "tokens" event persists any newly issued token back to the User row
 * so the next call doesn't need to refresh again.
 */
export async function getGoogleAuthClient(userId: string): Promise<OAuth2Client> {
  // NextAuth's JWT session is stateless — if the User row behind this
  // session's id was deleted (account deletion, a DB reset, disconnect
  // during testing, etc.) the browser's cookie still looks valid but no
  // longer refers to a real account. Treat that exactly like "needs to sign
  // in again" instead of letting a raw Prisma "record not found" reach the
  // UI (findUniqueOrThrow would throw that directly).
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ReauthRequiredError();
  }

  if (!user.accessToken || !user.refreshToken) {
    throw new ReauthRequiredError();
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
  });

  oauth2Client.on("tokens", (tokens) => {
    void prisma.user.update({
      where: { id: userId },
      data: {
        accessToken: tokens.access_token ?? undefined,
        refreshToken: tokens.refresh_token ?? undefined,
      },
    });
  });

  return oauth2Client;
}
