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
