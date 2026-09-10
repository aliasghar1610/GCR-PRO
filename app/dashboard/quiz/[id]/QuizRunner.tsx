"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Check, X, ChevronDown, Share2, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/cn";

type Question = { id: string; question: string; options: string[] };
type Feedback = { id: string; correctAnswer: string; explanation: string | null };
type Result = { score: number; total: number; feedback: Feedback[] };

export function QuizRunner({
  quizId,
  title,
  questions,
}: {
  quizId: string;
  title: string;
  questions: Question[];
}) {
  const toast = useToast();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;
  const current = questions[index];

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

  function handleRetake() {
    setResult(null);
    setAnswers({});
    setIndex(0);
    setError(null);
  }

  async function handleShare() {
    const url = `${window.location.origin}/quiz/${quizId}/share`;
    await navigator.clipboard.writeText(url);
    toast("Read-only link copied");
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (result) {
    const percent = result.total === 0 ? 0 : (result.score / result.total) * 100;
    const feedbackById = new Map(result.feedback.map((f) => [f.id, f]));

    return (
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
        <Card className="flex flex-col items-center gap-3 py-8">
          <ScoreRing percent={percent} />
          <p className="text-sm text-text-muted">
            {result.score} of {result.total} correct
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleRetake}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-text-body hover:bg-bg-subtle transition-colors"
            >
              <RotateCcw className="size-4" /> Retake
            </button>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-text-body hover:bg-bg-subtle transition-colors"
            >
              <Share2 className="size-4" /> Share
            </button>
          </div>
        </Card>

        <div className="flex flex-col gap-3">
          {questions.map((q, i) => {
            const fb = feedbackById.get(q.id);
            const studentAnswer = answers[q.id];
            const correct = fb ? studentAnswer === fb.correctAnswer : false;
            const isOpen = expanded.has(q.id);
            return (
              <Card key={q.id} className="p-0 overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <span
                    className={cn(
                      "flex items-center justify-center size-6 rounded-full shrink-0 mt-0.5",
                      correct ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                    )}
                  >
                    {correct ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">
                      {i + 1}. {q.question}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      Your answer: <span className="text-text-body">{studentAnswer ?? "(skipped)"}</span>
                    </p>
                    {!correct && fb && (
                      <p className="text-xs text-text-muted mt-0.5">
                        Correct answer: <span className="text-success">{fb.correctAnswer}</span>
                      </p>
                    )}
                    {fb?.explanation && (
                      <button
                        onClick={() => toggleExpanded(q.id)}
                        className="flex items-center gap-1 text-xs text-accent mt-2 hover:underline"
                      >
                        Explanation
                        <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
                      </button>
                    )}
                    {isOpen && fb?.explanation && (
                      <p className="text-xs text-text-muted mt-1.5 leading-relaxed">{fb.explanation}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="h-1.5 bg-bg-subtle shrink-0">
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${(answeredCount / questions.length) * 100}%` }}
        />
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6 w-full">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted">{title}</p>
          <Link href="/dashboard/quiz" className="text-sm text-text-muted hover:text-text-body">
            Exit
          </Link>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setIndex(i)}
              className={cn(
                "flex items-center justify-center size-8 rounded-full text-sm font-medium transition-colors",
                i === index
                  ? "bg-accent text-white"
                  : answers[q.id]
                    ? "bg-accent-soft text-accent"
                    : "bg-bg-subtle text-text-muted hover:text-text-body"
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div>
          <p className="text-lg font-medium text-text-primary leading-snug">{current.question}</p>
        </div>

        <div className="flex flex-col gap-2.5">
          {current.options.map((opt) => {
            const selected = answers[current.id] === opt;
            return (
              <button
                key={opt}
                onClick={() => setAnswers((a) => ({ ...a, [current.id]: opt }))}
                className={cn(
                  "w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors",
                  selected
                    ? "border-accent bg-accent-soft text-text-primary"
                    : "border-border bg-bg-card text-text-body hover:border-border-strong hover:bg-bg-subtle"
                )}
              >
                {opt}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-text-body hover:bg-bg-subtle transition-colors disabled:opacity-40"
          >
            <ChevronLeft className="size-4" /> Prev
          </button>

          {index === questions.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={!allAnswered || submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-60"
            >
              {submitting ? "Scoring…" : "Submit"}
            </button>
          ) : (
            <button
              onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
            >
              Next <ChevronRight className="size-4" />
            </button>
          )}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
