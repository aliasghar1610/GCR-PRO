import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; resetAt: Date };

/**
 * Sliding-window per-user call counter (6.4.4) — cheap cost control so one
 * user in a loop can't drain AI credits. Counts are kept in Postgres, not in
 * process memory, because serverless instances don't share memory and an
 * in-memory limit would reset with every cold start.
 *
 * Records the call as a side effect when it's allowed.
 */
export async function checkRateLimit(
  userId: string,
  route: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - windowMs);

  const calls = await prisma.apiUsage.findMany({
    where: { userId, route, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (calls.length >= limit) {
    // The window frees up when the oldest call in it ages out.
    return { allowed: false, resetAt: new Date(calls[0].createdAt.getTime() + windowMs) };
  }

  await prisma.apiUsage.create({ data: { userId, route } });
  return { allowed: true };
}

/**
 * The read half of `checkRateLimit`, without recording the call.
 *
 * Exists so a caller can batch the usage record into a `$transaction` with
 * its own write and pay one database round trip instead of two. On a slow
 * link that is not a micro-optimisation: each round trip to a distant
 * database costs seconds, and a route that spends three of them serially
 * runs past a serverless execution limit and is killed mid-request.
 *
 * A caller that uses this MUST also write `rateLimitRecord()`, or the call
 * goes uncounted and the limit does not hold. Prefer `checkRateLimit` unless
 * you are actually batching.
 */
export async function peekRateLimit(
  userId: string,
  route: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - windowMs);

  const calls = await prisma.apiUsage.findMany({
    where: { userId, route, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { createdAt: true },
  });

  if (calls.length >= limit) {
    return { allowed: false, resetAt: new Date(calls[0].createdAt.getTime() + windowMs) };
  }
  return { allowed: true };
}

/**
 * The write half: an un-awaited Prisma promise, so it can be handed to
 * `prisma.$transaction([...])` alongside the caller's own write and sent as
 * one batch. Awaiting it directly also works and is simply the second query.
 */
export function rateLimitRecord(userId: string, route: string) {
  return prisma.apiUsage.create({ data: { userId, route } });
}

/** 429 with a concrete reset time, per spec §9 — never a bare failure. */
export function rateLimitResponse(label: string, resetAt: Date): NextResponse {
  const secondsLeft = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: `You've hit the limit for ${label}.`,
      resetAt: resetAt.toISOString(),
      retryAfterSeconds: secondsLeft,
    },
    { status: 429, headers: { "Retry-After": String(secondsLeft) } }
  );
}
