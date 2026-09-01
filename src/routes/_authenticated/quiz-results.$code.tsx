import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getQuizResults } from "@/lib/quiz.functions";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/quiz-results/$code")({
  head: () => ({
    meta: [
      { title: "Quiz Results — Lecture Lab AI" },
      { name: "description", content: "Review sorted student quiz results and download a CSV report." },
      { property: "og:title", content: "Quiz Results — Lecture Lab AI" },
      { property: "og:description", content: "Review student quiz results and download a CSV report." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuizResults,
});

type Attempt = { studentName: string; email: string; score: number; total: number; tabSwitches: number; submittedAt: string };
type Results = { quiz: { code: string; topic: string; activityType: string; createdAt: string }; attempts: Attempt[] };

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function QuizResults() {
  const { code } = Route.useParams();
  const getResults = useServerFn(getQuizResults);
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getResults({ data: { code } }).then((data) => setResults(data as Results)).catch((error) => toast.error(error instanceof Error ? error.message : "Could not load results.")).finally(() => setLoading(false));
  }, [code, getResults]);

  const downloadCsv = () => {
    if (!results) return;
    const rows = [
      ["Name", "Email", "Score", "Total", "%", "Tab Switches", "Date"],
      ...results.attempts.map((attempt) => [
        attempt.studentName,
        attempt.email,
        attempt.score,
        attempt.total,
        attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0,
        attempt.tabSwitches,
        new Date(attempt.submittedAt).toLocaleString(),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lecture-lab-${results.quiz.code}-results.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <header className="no-print border-b border-border/60 bg-card/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg gradient-hero text-primary-foreground"><Sparkles className="h-4 w-4" /></span><span className="font-bold">Lecture Lab AI</span></Link>
          <Link to="/quiz" className="text-sm font-medium text-muted-foreground hover:text-foreground">Student quiz</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {loading ? <div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading results…</div> : results ? (
          <section>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quiz {results.quiz.code}</p><h1 className="mt-1 text-3xl font-bold">{results.quiz.topic}</h1><p className="mt-2 text-sm text-muted-foreground">{results.attempts.length} submission{results.attempts.length === 1 ? "" : "s"}</p></div>
              <Button onClick={downloadCsv} disabled={results.attempts.length === 0}><Download className="mr-2 h-4 w-4" /> Download CSV</Button>
            </div>
            <div className="overflow-x-auto surface-card">
              <table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-border bg-muted/40"><tr>{["Name", "Email", "Score", "%", "Tab switches", "Date"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{results.attempts.map((attempt, index) => <tr key={`${attempt.email}-${attempt.submittedAt}-${index}`} className="border-b border-border last:border-0"><td className="px-4 py-3 font-medium">{attempt.studentName}</td><td className="px-4 py-3 text-muted-foreground">{attempt.email}</td><td className="px-4 py-3">{attempt.score} / {attempt.total}</td><td className="px-4 py-3">{attempt.total ? Math.round((attempt.score / attempt.total) * 100) : 0}%</td><td className="px-4 py-3">{attempt.tabSwitches}</td><td className="px-4 py-3 text-muted-foreground">{new Date(attempt.submittedAt).toLocaleString()}</td></tr>)}</tbody></table>
              {results.attempts.length === 0 && <p className="p-8 text-center text-muted-foreground">No students have submitted this quiz yet.</p>}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}