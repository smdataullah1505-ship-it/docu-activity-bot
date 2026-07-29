import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  ShieldAlert,
  Save,
  Trophy,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth-gate";
import { AppHeader } from "@/components/app-header";
import { useSession, useProfile } from "@/lib/use-profile";
import { Button } from "@/components/ui/button";
import {
  getQuizByShareCode,
  getQuiz,
  getQuizAnswerKey,
  startOrResumeAttempt,
  saveAttemptProgress,
  submitAttempt,
  type QuizQuestion,
} from "@/lib/quiz.functions";


export const Route = createFileRoute("/quiz/$code")({
  head: () => ({ meta: [{ title: "Quiz — Lecture Lab AI" }] }),
  component: () => (
    <AuthGate>
      <QuizPage />
    </AuthGate>
  ),
});

function QuizPage() {
  const { session } = useSession();
  const { profile } = useProfile(session);
  if (!session || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader role={profile.role} displayName={profile.display_name} email={profile.email} />
      <QuizRunner role={profile.role} />
    </div>
  );
}

interface Attempt {
  id: string;
  quiz_id: string;
  answers: { question_index: number; selected_option: string }[];
  current_question_index: number;
  score: number | null;
  is_completed: boolean;
  started_at: string;
  completed_at: string | null;
  suspicious_events: { event_type: string; timestamp: string }[];
  time_taken: number | null;
}

interface Quiz {
  id: string;
  title: string;
  topic: string;
  questions: QuizQuestion[];
  time_limit: number | null;
  is_practice: boolean;
  is_published: boolean;
  question_count: number | null;
  creator_id: string;
}

function QuizRunner({ role }: { role: "teacher" | "student" }) {
  const { code } = useParams({ from: "/quiz/$code" });
  const byCodeFn = useServerFn(getQuizByShareCode);
  const byIdFn = useServerFn(getQuiz);
  const answerKeyFn = useServerFn(getQuizAnswerKey);
  const startFn = useServerFn(startOrResumeAttempt);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [started, setStarted] = useState(false);


  useEffect(() => {
    let active = true;
    setLoading(true);
    const looksLikeUuid = code.length > 8;
    const promise = looksLikeUuid
      ? byIdFn({ data: { id: code } })
      : byCodeFn({ data: { code } });
    promise
      .then(async (q) => {
        if (!active) return;
        setQuiz(q as unknown as Quiz);
      })
      .catch((e) => {
        if (active) setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Answers are withheld by the server until the attempt is submitted.
  useEffect(() => {
    if (!quiz || !attempt?.is_completed) return;
    if (quiz.questions.some((q) => q.correct_answer)) return;
    let active = true;
    answerKeyFn({ data: { quizId: quiz.id } })
      .then((res) => {
        if (!active) return;
        setQuiz((prev) =>
          prev ? { ...prev, questions: res.questions as QuizQuestion[] } : prev,
        );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?.id, attempt?.is_completed]);


  const beginAttempt = async () => {
    if (!quiz) return;
    try {
      const a = await startFn({ data: { quizId: quiz.id } });
      setAttempt(a as unknown as Attempt);
      setStarted(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start attempt");
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (err || !quiz) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-white border rounded-2xl p-6 text-center">
        <X className="h-8 w-8 text-rose-500 mx-auto" />
        <h2 className="mt-2 font-semibold">Quiz not found</h2>
        <p className="text-sm text-slate-600 mt-1">{err || "Check the code and try again."}</p>
        <Link to="/" className="inline-block mt-4 text-indigo-600 hover:underline text-sm">
          Back to dashboard
        </Link>
      </div>
    );
  }




  // For preview mode (teacher viewing a teacher quiz they created)
  if (role === "teacher" && !quiz.is_practice && !started) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
        <div className="bg-white border rounded-2xl p-6">
          <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
            Teacher preview
          </div>
          <h1 className="text-2xl font-bold mt-1">{quiz.title}</h1>
          <p className="text-sm text-slate-600 mt-2">Topic: {quiz.topic}</p>
          <div className="mt-4 text-sm text-slate-600 flex items-center gap-4">
            <span>{quiz.questions.length} questions</span>
            {quiz.time_limit && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" /> {quiz.time_limit} min
              </span>
            )}
          </div>
          <div className="mt-5 space-y-3">
            {quiz.questions.map((q, i) => (
              <div key={i} className="border rounded-lg p-3 text-sm">
                <div className="font-medium">
                  Q{i + 1}. {q.question}
                </div>
                <ul className="mt-2 space-y-1">
                  {q.options.map((o, j) => (
                    <li
                      key={j}
                      className={
                        o === q.correct_answer
                          ? "text-emerald-700 font-medium"
                          : "text-slate-600"
                      }
                    >
                      {String.fromCharCode(65 + j)}. {o}
                      {o === q.correct_answer && " ✓"}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-500">{q.explanation}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <Link to="/analytics/$quizId" params={{ quizId: quiz.id }}>
              <Button className="bg-indigo-600 hover:bg-indigo-700">View analytics</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!started || !attempt) {
    return <WelcomeScreen quiz={quiz} onStart={beginAttempt} />;
  }

  if (attempt.is_completed) {
    return <ResultsScreen quiz={quiz} attempt={attempt} />;
  }

  return (
    <ActiveQuiz quiz={quiz} attempt={attempt} onComplete={(a) => setAttempt(a)} />
  );
}

function WelcomeScreen({ quiz, onStart }: { quiz: Quiz; onStart: () => void }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="bg-white border rounded-2xl shadow-sm p-6 text-center">
        <Trophy className="h-10 w-10 text-indigo-600 mx-auto" />
        <h1 className="text-2xl font-bold mt-3">{quiz.title}</h1>
        <p className="text-sm text-slate-600 mt-1">Topic: {quiz.topic}</p>
        <div className="mt-4 flex items-center justify-center gap-6 text-sm text-slate-600">
          <span>📝 {quiz.questions.length} questions</span>
          {quiz.time_limit && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" /> {quiz.time_limit} min
            </span>
          )}
        </div>
        {!quiz.is_practice && (
          <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            ⚠️ You can attempt this quiz only once. Please stay on this tab — switching tabs is logged.
          </p>
        )}
        <Button onClick={onStart} className="mt-5 bg-indigo-600 hover:bg-indigo-700 w-full">
          Start Quiz
        </Button>
      </div>
    </div>
  );
}

function ActiveQuiz({
  quiz,
  attempt,
  onComplete,
}: {
  quiz: Quiz;
  attempt: Attempt;
  onComplete: (a: Attempt) => void;
}) {
  const saveFn = useServerFn(saveAttemptProgress);
  const submitFn = useServerFn(submitAttempt);
  const startedAtRef = useRef<number>(
    new Date(attempt.started_at).getTime() || Date.now(),
  );
  const [idx, setIdx] = useState(attempt.current_question_index || 0);
  const [answers, setAnswers] = useState<Map<number, string>>(() => {
    const m = new Map<number, string>();
    for (const a of attempt.answers || []) m.set(a.question_index, a.selected_option);
    return m;
  });
  const [events, setEvents] = useState<{ event_type: string; timestamp: string }[]>(
    attempt.suspicious_events || [],
  );
  const [selected, setSelected] = useState<string | null>(answers.get(idx) ?? null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(
    quiz.time_limit
      ? Math.max(0, quiz.time_limit * 60 - Math.floor((Date.now() - startedAtRef.current) / 1000))
      : null,
  );

  // Tab-switch detection
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        addEvent("tab_hidden");
        toast.warning("Please stay on the quiz tab — events are logged.");
      } else addEvent("tab_visible");
    };
    const onBlur = () => addEvent("window_blur");
    const onFocus = () => addEvent("window_focus");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer
  useEffect(() => {
    if (remaining == null) return;
    if (remaining <= 0) {
      void doSubmit();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => (r != null ? r - 1 : null)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const addEvent = (type: string) => {
    setEvents((e) => [...e, { event_type: type, timestamp: new Date().toISOString() }]);
  };

  useEffect(() => {
    setSelected(answers.get(idx) ?? null);
  }, [idx, answers]);

  const persist = async (nextIdx: number, ans: Map<number, string>, evs: typeof events) => {
    setSaving(true);
    try {
      await saveFn({
        data: {
          attemptId: attempt.id,
          answers: Array.from(ans, ([question_index, selected_option]) => ({
            question_index,
            selected_option,
          })),
          currentQuestionIndex: nextIdx,
          suspiciousEvents: evs,
        },
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const lockIn = async () => {
    if (!selected) return;
    const nextAnswers = new Map(answers);
    nextAnswers.set(idx, selected);
    setAnswers(nextAnswers);
    const nextIdx = Math.min(idx + 1, quiz.questions.length - 1);
    setIdx(nextIdx);
    await persist(nextIdx, nextAnswers, events);
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const finalAnswers = new Map(answers);
      if (selected != null) finalAnswers.set(idx, selected);
      const timeTaken = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const result = await submitFn({
        data: {
          attemptId: attempt.id,
          answers: Array.from(finalAnswers, ([question_index, selected_option]) => ({
            question_index,
            selected_option,
          })),
          timeTaken,
          suspiciousEvents: events,
        },
      });
      toast.success(`Submitted! Score: ${result.score}/${result.total}`);
      onComplete({
        ...attempt,
        answers: Array.from(finalAnswers, ([question_index, selected_option]) => ({
          question_index,
          selected_option,
        })),
        score: result.score,
        is_completed: true,
        completed_at: new Date().toISOString(),
        time_taken: timeTaken,
        suspicious_events: events,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const q = quiz.questions[idx];
  const isLast = idx === quiz.questions.length - 1;
  const answeredCount = answers.size;

  const mins = remaining != null ? Math.floor(remaining / 60) : 0;
  const secs = remaining != null ? remaining % 60 : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="font-medium">
          Question {idx + 1} of {quiz.questions.length}
        </div>
        {remaining != null && (
          <div
            className={`inline-flex items-center gap-1 font-mono ${
              remaining < 60 ? "text-rose-600" : "text-slate-700"
            }`}
          >
            <Clock className="h-4 w-4" /> {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
        )}
      </div>

      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 transition-all"
          style={{ width: `${((idx + 1) / quiz.questions.length) * 100}%` }}
        />
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <p className="font-medium">{q.question}</p>
        <div className="mt-4 space-y-2">
          {q.options.map((opt, i) => (
            <label
              key={i}
              className={`block px-3 py-2.5 border rounded-lg cursor-pointer transition ${
                selected === opt
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-200 hover:border-indigo-300"
              }`}
            >
              <input
                type="radio"
                name={`q${idx}`}
                className="mr-2"
                checked={selected === opt}
                onChange={() => setSelected(opt)}
              />
              <span className="font-semibold text-slate-500 mr-2">
                {String.fromCharCode(65 + i)}.
              </span>
              {opt}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          onClick={() => setIdx(Math.max(0, idx - 1))}
          disabled={idx === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <div className="text-xs text-slate-500 inline-flex items-center gap-1">
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </>
          ) : savedFlash ? (
            <>
              <Save className="h-3 w-3 text-emerald-600" /> Progress saved
            </>
          ) : (
            <>{answeredCount}/{quiz.questions.length} answered</>
          )}
        </div>
        {isLast ? (
          <Button
            onClick={doSubmit}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Quiz"}
          </Button>
        ) : (
          <Button
            onClick={lockIn}
            disabled={!selected}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {events.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 inline-flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5" /> {events.length} tab-switch event(s) logged
        </div>
      )}
    </div>
  );
}

function ResultsScreen({ quiz, attempt }: { quiz: Quiz; attempt: Attempt }) {
  const total = quiz.questions.length;
  const score = attempt.score ?? 0;
  const pct = Math.round((score / total) * 100);
  const answers = new Map(attempt.answers.map((a) => [a.question_index, a.selected_option]));
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="bg-white border rounded-2xl shadow-sm p-6 text-center">
        <Trophy className="h-10 w-10 text-amber-500 mx-auto" />
        <h1 className="text-2xl font-bold mt-3">Quiz complete!</h1>
        <div className="text-4xl font-bold mt-2 text-indigo-600">{pct}%</div>
        <div className="text-sm text-slate-600 mt-1">
          {score} out of {total} correct
        </div>
        {attempt.suspicious_events.length > 0 && (
          <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 inline-flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" /> Flagged: {attempt.suspicious_events.length} tab-switch event(s)
          </div>
        )}
      </div>

      <div className="space-y-3">
        {quiz.questions.map((q, i) => {
          const chosen = answers.get(i);
          const ok = chosen === q.correct_answer;
          return (
            <div key={i} className="bg-white border rounded-2xl p-4">
              <div className="flex items-start gap-2">
                {ok ? (
                  <Check className="h-5 w-5 text-emerald-600 mt-0.5" />
                ) : (
                  <X className="h-5 w-5 text-rose-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    Q{i + 1}. {q.question}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {q.options.map((o, j) => {
                      const isCorrect = o === q.correct_answer;
                      const isChosen = o === chosen;
                      return (
                        <li
                          key={j}
                          className={`px-2 py-1 rounded ${
                            isCorrect
                              ? "bg-emerald-50 text-emerald-800"
                              : isChosen
                                ? "bg-rose-50 text-rose-800"
                                : "text-slate-600"
                          }`}
                        >
                          {String.fromCharCode(65 + j)}. {o}
                          {isCorrect && " ✓"}
                          {!isCorrect && isChosen && " ✗ (your answer)"}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded">
                    💡 {q.explanation}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Link to="/" className="block text-center mt-4">
        <Button className="bg-indigo-600 hover:bg-indigo-700">Back to dashboard</Button>
      </Link>
    </div>
  );
}
