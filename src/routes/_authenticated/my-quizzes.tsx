import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ArrowRight, ClipboardList } from "lucide-react";
import { listMyQuizzes } from "@/lib/quiz.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/my-quizzes")({
  head: () => ({
    meta: [
      { title: "My Quizzes — Lecture Lab AI" },
      {
        name: "description",
        content: "See every quiz you have created, with its join code and a link to live results.",
      },
      { property: "og:title", content: "My Quizzes — Lecture Lab AI" },
      {
        property: "og:description",
        content: "See every quiz you have created, with its join code and a link to live results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyQuizzes,
});

function MyQuizzes() {
  const listFn = useServerFn(listMyQuizzes);
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-quizzes"],
    queryFn: () => listFn(),
  });

  const quizzes = data?.quizzes ?? [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Quizzes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Share a code with your class, then open the results page to track scores.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/">Back to generator</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your quizzes…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load your quizzes."}
        </p>
      ) : quizzes.length === 0 ? (
        <div className="surface-elevated p-8 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">You haven't created a quiz yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate an MCQ or Fill in the Blanks activity, then choose “Start Quiz”.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {quizzes.map((q) => (
            <li
              key={q.code}
              className="surface-elevated flex flex-wrap items-center justify-between gap-4 p-4"
            >
              <div>
                <p className="font-semibold">{q.topic}</p>
                <p className="text-xs text-muted-foreground">
                  {q.activity_type === "mcqs" ? "MCQs" : "Fill in the Blanks"} ·{" "}
                  {new Date(q.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-muted px-3 py-1 font-mono text-base font-semibold tracking-widest">
                  {q.code}
                </span>
                <Button asChild size="sm">
                  <Link to="/quiz-results/$code" params={{ code: q.code }}>
                    Results <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
