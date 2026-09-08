"use client";

import { useState } from "react";

type Question = { id: string; question: string; options: unknown };
type Feedback = { id: string; correctAnswer: string; explanation: string | null };

export function QuizRunner({ quizId, questions }: { quizId: string; questions: Question[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; total: number; feedback: Feedback[] } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/quiz/${quizId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  const feedbackById = new Map((result?.feedback ?? []).map((f) => [f.id, f]));

  return (
    <div className="flex flex-col gap-6">
      {questions.map((q, i) => {
        const options = Array.isArray(q.options) ? (q.options as string[]) : [];
        const fb = feedbackById.get(q.id);
        return (
          <div key={q.id} className="border rounded p-4">
            <div className="font-medium mb-2">
              {i + 1}. {q.question}
            </div>
            <div className="flex flex-col gap-1">
              {options.map((opt) => {
                const isSelected = answers[q.id] === opt;
                const isCorrect = fb && opt === fb.correctAnswer;
                const isWrongSelected = fb && isSelected && opt !== fb.correctAnswer;
                return (
                  <label
                    key={opt}
                    className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${
                      isCorrect
                        ? "bg-green-100 dark:bg-green-950"
                        : isWrongSelected
                          ? "bg-red-100 dark:bg-red-950"
                          : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={isSelected}
                      disabled={!!result}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
            {fb?.explanation && <div className="text-xs text-gray-500 mt-2">{fb.explanation}</div>}
          </div>
        );
      })}

      {!result ? (
        <button
          onClick={handleSubmit}
          disabled={submitting || Object.keys(answers).length < questions.length}
          className="border rounded px-3 py-1.5 text-sm w-fit disabled:opacity-50"
        >
          {submitting ? "Scoring..." : "Submit answers"}
        </button>
      ) : (
        <div className="font-medium">
          Score: {result.score} / {result.total}
        </div>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
