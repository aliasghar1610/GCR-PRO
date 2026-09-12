import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

/**
 * The session cookie is a stateless JWT — if the User row behind it was
 * deleted (account deletion, switching Google accounts mid-testing, a DB
 * reset, etc.) the cookie still decodes fine but no longer refers to a real
 * account. Callers that gate on "is signed in" should also check this, or a
 * stale session reads as authenticated right up until something that
 * queries the User row by id throws a raw "record not found".
 */
export async function sessionUserExists(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  return user != null;
}

/**
 * Returns the signed-in user from the session, redirecting to "/" if there
 * isn't one.
 *
 * Dashboard access is already gated by `app/dashboard/layout.tsx`, but a
 * layout's redirect does not stop its children from rendering: React renders
 * the layout and the page concurrently, so a page body still runs once with
 * no session before the redirect lands. Reading `session!.user.id` there
 * threw a TypeError on every unauthenticated request — harmless to the
 * client, which still got the layout's 307, but it buried a stack trace in
 * the logs each time. Pages call this instead of asserting non-null.
 */
export async function requireSessionUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/");
  }
  return session.user;
}
