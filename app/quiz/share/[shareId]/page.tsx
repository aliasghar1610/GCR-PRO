import { Check } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";

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
      <main className="min-h-dvh bg-bg-app flex items-center justify-center px-4">
        <Card className="p-0 w-full max-w-md">
          <EmptyState title="Quiz not found" description="This link may be invalid or the quiz was removed." />
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-bg-app px-4 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{quiz.title}</h1>
          <p className="text-sm text-text-muted mt-1">
            Read-only view — answers and explanations shown below.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {quiz.questions.map((q, i) => {
            const options = Array.isArray(q.options) ? (q.options as string[]) : [];
            return (
              <Card key={q.id}>
                <p className="text-sm font-medium text-text-primary mb-2">
                  {i + 1}. {q.question}
                </p>
                <ul className="flex flex-col gap-1 text-sm">
                  {options.map((opt) => {
                    const isCorrect = opt === q.correctAnswer;
                    return (
                      <li
                        key={opt}
                        className={cn(
                          "flex items-center gap-1.5",
                          isCorrect ? "font-medium text-success" : "text-text-body"
                        )}
                      >
                        {isCorrect && <Check className="size-3.5 shrink-0" />}
                        {opt}
                      </li>
                    );
                  })}
                </ul>
                {q.explanation && (
                  <p className="text-xs text-text-muted mt-2 leading-relaxed">{q.explanation}</p>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
