import { google, classroom_v1 } from "googleapis";
import { prisma } from "@/lib/prisma";

/**
 * Builds an authenticated Classroom client for a user. The underlying
 * OAuth2Client refreshes the access token on demand using the stored
 * refresh token; the "tokens" event persists any newly issued token back
 * to the User row so the next call doesn't need to refresh again.
 */
export async function getClassroomClient(
  userId: string
): Promise<classroom_v1.Classroom> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!user.accessToken || !user.refreshToken) {
    throw new Error("No stored Google tokens for this user — sign in again.");
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

  return google.classroom({ version: "v1", auth: oauth2Client });
}
