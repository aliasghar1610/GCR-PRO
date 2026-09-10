import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const MAX_LEAD_HOURS = 24 * 14; // widest per-user window we'll ever honor

export async function GET(req: Request) {
  // This iterates every user's due assignments and sends email — it's meant
  // to be called by a cron trigger, not left open to the public internet.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const now = new Date();
  // Cast a wide net (the longest lead time anyone could have configured),
  // then filter each assignment against its own user's lead time below —
  // alertsEnabled/alertLeadHours are per-user (Settings > Notifications).
  const widestCutoff = new Date(now.getTime() + MAX_LEAD_HOURS * 60 * 60 * 1000);

  const dueSoon = await prisma.assignment.findMany({
    where: { dueDate: { gte: now, lte: widestCutoff } },
    include: { course: { include: { user: true } } },
  });

  // Skip assignment/user pairs already alerted (AlertLog dedupe), users who
  // opted out, and assignments outside that user's own lead-time window.
  const alreadyAlerted = new Set(
    (
      await prisma.alertLog.findMany({
        where: { assignmentId: { in: dueSoon.map((a) => a.id) } },
      })
    ).map((log) => `${log.assignmentId}:${log.userId}`)
  );

  const pending = dueSoon.filter((a) => {
    const user = a.course.user;
    if (!user.alertsEnabled) return false;
    if (alreadyAlerted.has(`${a.id}:${user.id}`)) return false;
    const userCutoff = now.getTime() + user.alertLeadHours * 60 * 60 * 1000;
    return a.dueDate!.getTime() <= userCutoff;
  });

  // Group into one summary email per user rather than one per assignment.
  const byUser = new Map<string, { email: string; name: string | null; assignments: typeof pending }>();
  for (const assignment of pending) {
    const user = assignment.course.user;
    const key = user.id;
    if (!byUser.has(key)) {
      byUser.set(key, { email: user.email, name: user.name, assignments: [] });
    }
    byUser.get(key)!.assignments.push(assignment);
  }

  if (byUser.size === 0) {
    return NextResponse.json({ usersAlerted: 0, assignmentsAlerted: 0 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "RESEND_API_KEY is not set — no emails sent.",
        wouldAlert: Array.from(byUser.values()).map((u) => ({
          email: u.email,
          assignments: u.assignments.map((a) => a.title),
        })),
      },
      { status: 200 }
    );
  }

  const resend = new Resend(apiKey);
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  let usersAlerted = 0;
  let assignmentsAlerted = 0;

  for (const [userId, { email, name, assignments }] of byUser) {
    const listHtml = assignments
      .map(
        (a) =>
          `<li><strong>${a.title}</strong> (${a.course.name}) — due ${a.dueDate!.toLocaleString()}</li>`
      )
      .join("");

    const { error } = await resend.emails.send({
      from: fromAddress,
      to: email,
      subject: `${assignments.length} assignment${assignments.length === 1 ? "" : "s"} due within 48 hours`,
      html: `<p>Hi ${name ?? "there"},</p><p>These are coming up soon:</p><ul>${listHtml}</ul>`,
    });

    if (error) {
      console.error(`Failed to send alert email to ${email}:`, error);
      continue;
    }

    await prisma.alertLog.createMany({
      data: assignments.map((a) => ({ assignmentId: a.id, userId })),
      skipDuplicates: true,
    });

    usersAlerted++;
    assignmentsAlerted += assignments.length;
  }

  return NextResponse.json({ usersAlerted, assignmentsAlerted });
}
