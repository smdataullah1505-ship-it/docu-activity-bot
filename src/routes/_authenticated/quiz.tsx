import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Check, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { getQuizForStudent, submitQuizAttempt } from "@/lib/quiz.functions";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/quiz")({
  head: () => ({
    meta: [
      { title: "Join Quiz — Lecture Lab AI" },
      { name: "description", content: "Enter a quiz code and complete a Lecture Lab AI classroom quiz." },
      { property: "og:title", content: "Join Quiz — Lecture Lab AI" },
      { property: "og:description", content: "Enter a quiz code and complete a classroom quiz." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentQuiz,
});

type QuizItem = { question?: string; options?: string[]; sentence?: string };
type QuizData = {
  code: string;
  topic: string;
  activityType: "mcqs" | "fillBlanks";
  questions: { activityType: "mcqs" | "fillBlanks"; items: QuizItem[] };
  attempt: { score: number; total: number; tab_switches: number; submitted_at: string } | null;
};
type Submission = { score: number; total: number; details: { index: number; correct: boolean; expected: string }[] };

function StudentQuiz() {
  const getQuiz = useServerFn(getQuizForStudent);
  const submitQuiz = useServerFn(submitQuizAttempt);
  const [code, setCode] = useState("");
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [tabSwitches, setTabSwitches] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);

  useEffect(() => {
    if (!quiz || submission) return;
    const warn = () => {
      setTabSwitches((count) => count + 1);
      toast.warning("Tab switch detected. Your teacher will see this in the results.");
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") warn();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", warn);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", warn);
    };
  }, [quiz, submission]);

  const loadQuiz = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await getQuiz({ data: { code: code.trim().toUpperCase() } });
      setQuiz(data as QuizData);
      setAnswers({});
      setSubmission(null);
      setTabSwitches(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load that quiz.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!quiz) return;
    setSubmitting(true);
    try {
      const orderedAnswers = quiz.questions.items.map((_, index) => answers[index] ?? "");
      const result = await submitQuiz({ data: { code: quiz.code, answers: orderedAnswers, tabSwitches } });
      setSubmission(result as Submission);
      toast.success("Your answers were submitted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit your answers.");
    } finally {
      setSubmitting(false);
    }
  };

  const answered = quiz?.questions.items.every((_, index) => Boolean(answers[index]?.trim())) ?? false;

  return (
    <div className="min-h-screen select-none" onContextMenu={(event) => event.preventDefault()} onCopy={(event) => event.preventDefault()} onSelect={(event) => event.preventDefault()}>
      <Toaster richColors position="top-center" />
      <header className="no-print border-b border-border/60 bg-card/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg gradient-hero text-primary-foreground"><Sparkles className="h-4 w-4" /></span>
            <span className="font-bold">Lecture Lab AI</span>
          </Link>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><ShieldAlert className="h-4 w-4" /> Assessment mode</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {!quiz ? (
          <section className="mx-auto max-w-md surface-elevated p-6">
            <h1 className="text-2xl font-bold">Join a quiz</h1>
            <p className="mt-2 text-sm text-muted-foreground">Enter the six-character code shared by your teacher.</p>
            <form className="mt-6 space-y-4" onSubmit={loadQuiz}>
              <Input aria-label="Quiz code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ABC234" maxLength={12} required />
              <Button className="w-full" disabled={loading || !code.trim()}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Load quiz
              </Button>
            </form>
          </section>
        ) : (
          <section>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quiz {quiz.code}</p>
                <h1 className="mt-1 text-3xl font-bold">{quiz.topic}</h1>
                <p className="mt-2 text-sm text-muted-foreground">Answer every question, then submit once. Tab switches: {tabSwitches}</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground"><AlertTriangle className="h-4 w-4" /> Switching tabs is recorded</div>
            </div>

            {quiz.attempt || submission ? (
              <div className="surface-card p-6">
                <h2 className="text-xl font-bold">Submission received</h2>
                <p className="mt-2 text-muted-foreground">Score: {submission?.score ?? quiz.attempt?.score} / {submission?.total ?? quiz.attempt?.total}</p>
              </div>
            ) : (
              <>
                <ol className="space-y-4">
                  {quiz.questions.items.map((item, index) => (
                    <li key={index} className="surface-card p-5">
                      <p className="font-semibold"><span className="mr-2 text-muted-foreground">Q{index + 1}.</span>{item.question ?? item.sentence}</p>
                      {quiz.activityType === "mcqs" ? (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {(item.options ?? []).map((option) => (
                            <Button key={option} type="button" variant={answers[index] === option ? "default" : "outline"} className="h-auto justify-start whitespace-normal py-3 text-left" onClick={() => setAnswers((current) => ({ ...current, [index]: option }))}>
                              {option}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <Input className="mt-4 select-text" value={answers[index] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [index]: event.target.value }))} placeholder="Type your answer" maxLength={2000} />
                      )}
                    </li>
                  ))}
                </ol>
                <div className="no-print mt-6 flex items-center gap-3">
                  <Button onClick={submit} disabled={!answered || submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Submit answers</Button>
                  {!answered && <span className="text-sm text-muted-foreground">Answer all questions before submitting.</span>}
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}