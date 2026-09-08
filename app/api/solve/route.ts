import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDriveFileText } from "@/lib/drive";
import { askClaude } from "@/lib/ai";

// Deliberately asks for a structured study aid, not a final answer to turn
// in — keeps this on the right side of academic integrity.
const SYSTEM_PROMPT = `You are a study assistant helping a student understand and approach their assignment. \
Never produce a final answer that could be submitted as-is. Instead, respond with exactly three \
sections, each starting on its own line with one of these headers:

Outline:
Approach:
Draft:

"Outline" lists the key concepts and steps involved. "Approach" explains how to think through the \
problem and what to watch out for. "Draft" is a rough, clearly-a-draft starting point the student \
should rework in their own words — not a polished submission.`;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const assignmentId = body?.assignmentId;
  if (!assignmentId) {
    return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, course: { userId } },
  });
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  let attachmentText = "";
  for (const fileId of assignment.driveFileIds) {
    try {
      const text = await getDriveFileText(userId, fileId);
      if (text) attachmentText += `\n\n--- Attachment ---\n${text}`;
    } catch (err) {
      console.error(`Failed to read Drive file ${fileId}:`, err);
    }
  }

  const userContent = `Assignment title: ${assignment.title}\n\nDescription: ${
    assignment.description ?? "(none)"
  }${attachmentText}`;

  try {
    const result = await askClaude(SYSTEM_PROMPT, userContent);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("AI solve failed:", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
