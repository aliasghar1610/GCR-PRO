import { prisma } from "@/lib/prisma";

export default async function QuizSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: { questions: true },
  });

  if (!quiz) {
    return (
      <main className="p-8">
        <p>Quiz not found.</p>
      </main>
    );
  }

  return (
    <main className="p-8 flex flex-col gap-6 max-w-2xl">
      <h1 className="text-xl font-semibold">{quiz.title}</h1>
      <p className="text-sm text-gray-500">
        Read-only view — answers and explanations shown below.
      </p>
      <div className="flex flex-col gap-4">
        {quiz.questions.map((q, i) => {
          const options = Array.isArray(q.options) ? (q.options as string[]) : [];
          return (
            <div key={q.id} className="border rounded p-4">
              <div className="font-medium mb-2">
                {i + 1}. {q.question}
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {options.map((opt) => (
                  <li
                    key={opt}
                    className={
                      opt === q.correctAnswer
                        ? "font-medium text-green-700 dark:text-green-400"
                        : ""
                    }
                  >
                    {opt}
                    {opt === q.correctAnswer && " (correct)"}
                  </li>
                ))}
              </ul>
              {q.explanation && (
                <div className="text-xs text-gray-500 mt-2">{q.explanation}</div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
