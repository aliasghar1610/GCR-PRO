import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDriveFileText } from "@/lib/drive";
import { askClaude } from "@/lib/ai";

const SYSTEM_PROMPT = `You generate multiple-choice quiz questions from study material. \
Respond with ONLY a JSON array (no prose, no markdown code fences) of exactly 5 objects, each shaped exactly as:
{"question": string, "options": string[4], "correctAnswer": string, "explanation": string}
"correctAnswer" must exactly match one of the four strings in "options".`;

type RawQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
};

function parseQuizJson(raw: string): RawQuestion[] {
  const cleaned = raw
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Model did not return valid JSON");
  }

  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of questions");
  for (const q of parsed) {
    if (
      typeof q !== "object" ||
      q === null ||
      typeof (q as RawQuestion).question !== "string" ||
      !Array.isArray((q as RawQuestion).options) ||
      typeof (q as RawQuestion).correctAnswer !== "string"
    ) {
      throw new Error("Malformed question in model response");
    }
  }
  return parsed as RawQuestion[];
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const assignmentId: string | undefined = body?.assignmentId;
  const courseId: string | undefined = body?.courseId;
  if (!assignmentId && !courseId) {
    return NextResponse.json(
      { error: "assignmentId or courseId is required" },
      { status: 400 }
    );
  }

  let material = "";
  let title = "Quiz";
  let resolvedCourseId: string | null = null;

  if (assignmentId) {
    const assignment = await prisma.assignment.findFirst({
      where: { id: assignmentId, course: { userId } },
    });
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    resolvedCourseId = assignment.courseId;
    title = `Quiz: ${assignment.title}`;
    material = `${assignment.title}\n${assignment.description ?? ""}`;
    for (const fileId of assignment.driveFileIds) {
      try {
        const text = await getDriveFileText(userId, fileId);
        if (text) material += `\n\n${text}`;
      } catch (err) {
        console.error(`Failed to read Drive file ${fileId}:`, err);
      }
    }
  } else if (courseId) {
    const course = await prisma.course.findFirst({
      where: { id: courseId, userId },
      include: { assignments: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    resolvedCourseId = course.id;
    title = `Quiz: ${course.name}`;
    material = course.assignments
      .map((a) => `${a.title}\n${a.description ?? ""}`)
      .join("\n\n");
  }

  if (!material.trim()) {
    return NextResponse.json(
      { error: "No material available to generate a quiz from" },
      { status: 400 }
    );
  }

  let questions: RawQuestion[];
  try {
    const raw = await askClaude(SYSTEM_PROMPT, material);
    questions = parseQuizJson(raw);
  } catch (err) {
    console.error("Quiz generation failed:", err);
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 });
  }

  const quiz = await prisma.quiz.create({
    data: {
      userId,
      courseId: resolvedCourseId,
      sourceAssignmentId: assignmentId ?? null,
      title,
      questions: {
        create: questions.map((q) => ({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation ?? null,
        })),
      },
    },
  });

  return NextResponse.json({ quizId: quiz.id });
}
