import "server-only";
import { google, classroom_v1 } from "googleapis";
import { getGoogleAuthClient } from "@/lib/google-auth";

/**
 * Builds an authenticated Classroom client for a user. Token refresh is
 * handled by the underlying OAuth2Client (see lib/google-auth.ts).
 */
export async function getClassroomClient(
  userId: string
): Promise<classroom_v1.Classroom> {
  const auth = await getGoogleAuthClient(userId);
  return google.classroom({ version: "v1", auth });
}
