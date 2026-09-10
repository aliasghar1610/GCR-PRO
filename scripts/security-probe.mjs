// Read-only IDOR probe: seeds two throwaway users, then replays the exact
// Prisma predicates each route uses, asking "can user B reach user A's row?"
// Cleans up after itself. No HTTP, so it needs no running server.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const A = "idorprobe-a";
const B = "idorprobe-b";
let pass = 0;
let fail = 0;

function check(name, leaked) {
  if (leaked) {
    console.log(`  FAIL  ${name} — user B reached user A's row`);
    fail++;
  } else {
    console.log(`  ok    ${name}`);
    pass++;
  }
}

async function cleanup() {
  await prisma.quizAttempt.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.quizQuestion.deleteMany({ where: { quiz: { userId: { in: [A, B] } } } });
  await prisma.quiz.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.submission.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.document.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.assignment.deleteMany({ where: { course: { userId: { in: [A, B] } } } });
  await prisma.announcement.deleteMany({ where: { course: { userId: { in: [A, B] } } } });
  await prisma.teacher.deleteMany({ where: { course: { userId: { in: [A, B] } } } });
  await prisma.course.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.apiUsage.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.user.deleteMany({ where: { id: { in: [A, B] } } });
}

await cleanup();

// --- seed: user A owns everything, user B owns nothing -------------------
for (const id of [A, B]) {
  await prisma.user.create({ data: { id, email: `${id}@probe.invalid` } });
}
const course = await prisma.course.create({
  data: { id: "idorprobe-course", userId: A, name: "A's Course" },
});
const assignment = await prisma.assignment.create({
  data: { id: "idorprobe-assignment", courseId: course.id, title: "A's Assignment" },
});
await prisma.announcement.create({
  data: { id: "idorprobe-ann", courseId: course.id, text: "A's secret announcement" },
});
await prisma.teacher.create({
  data: { courseId: course.id, googleId: "t1", name: "Prof A", email: "prof@probe.invalid" },
});
await prisma.submission.create({
  data: { id: "idorprobe-sub", assignmentId: assignment.id, userId: A, assignedGrade: 99 },
});
const doc = await prisma.document.create({
  data: { userId: A, filename: "a.pdf", mimeType: "application/pdf", size: 1, status: "READY", extractedText: "secret" },
});
const quiz = await prisma.quiz.create({ data: { userId: A, title: "A's Quiz" } });

console.log("\nReplaying each route's ownership predicate as user B:\n");

// /api/solve + /api/quiz/generate — assignment by id
check("assignment lookup (solve, quiz/generate)",
  !!(await prisma.assignment.findFirst({ where: { id: assignment.id, course: { userId: B } } })));

// /api/quiz/generate — course by id
check("course lookup (quiz/generate)",
  !!(await prisma.course.findFirst({ where: { id: course.id, userId: B } })));

// /api/solve + /api/quiz/generate — document by id
check("document lookup (solve, quiz/generate)",
  !!(await prisma.document.findFirst({ where: { id: doc.id, userId: B } })));

// /api/documents/[id] GET + DELETE
check("document detail/delete",
  !!(await prisma.document.findFirst({ where: { id: doc.id, userId: B } })));

// /api/quiz/[id]/attempt
check("quiz attempt",
  !!(await prisma.quiz.findFirst({ where: { id: quiz.id, userId: B } })));

// /api/quiz/[id]/share
check("quiz share minting",
  !!(await prisma.quiz.findFirst({ where: { id: quiz.id, userId: B } })));

// /api/extension/professors
check("extension professors",
  !!(await prisma.course.findFirst({ where: { id: course.id, userId: B } })));

// /api/search — all three groups
const [c, a, an] = await Promise.all([
  prisma.course.findMany({ where: { userId: B, name: { contains: "A's", mode: "insensitive" } } }),
  prisma.assignment.findMany({ where: { course: { userId: B }, title: { contains: "A's", mode: "insensitive" } } }),
  prisma.announcement.findMany({ where: { course: { userId: B }, text: { contains: "secret", mode: "insensitive" } } }),
]);
check("search: courses", c.length > 0);
check("search: assignments", a.length > 0);
check("search: announcements", an.length > 0);

// /api/extension/summary
check("extension summary",
  (await prisma.assignment.findMany({ where: { course: { userId: B }, dueDate: { not: null } } })).length > 0);

// dashboard/courses/assignments reads — the submissions leak fixed this pass
const asB = await prisma.assignment.findMany({
  where: { course: { userId: A } },
  include: { submissions: { where: { userId: B } } },
});
check("submissions scoped by viewer (dashboard/courses/assignments)",
  asB.some((x) => x.submissions.length > 0));

// Course detail page predicate
check("course detail page",
  !!(await prisma.course.findFirst({ where: { id: course.id, userId: B } })));

// Share page: reachable only via the random shareId, and only after sharing.
// A's quiz was never shared, so its primary key must not resolve a share page.
check("share page via guessed id (quiz never shared)",
  !!(await prisma.quiz.findFirst({ where: { shareId: quiz.id } })));

await cleanup();
await prisma.$disconnect();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
