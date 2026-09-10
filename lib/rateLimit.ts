import { prisma } from "@/lib/prisma";

/**
 * Sliding-window per-user call counter (6.4.4) — cheap cost control so one
 * user in a loop can't drain AI credits. Records the call as a side effect
 * when it's allowed.
 */
export async function checkRateLimit(
  userId: string,
  route: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.apiUsage.count({
    where: { userId, route, createdAt: { gte: since } },
  });
  if (count >= limit) return false;

  await prisma.apiUsage.create({ data: { userId, route } });
  return true;
}
