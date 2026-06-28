import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  ChevronLeft,
  Download,
  AlertTriangle,
  Users,
  Trophy,
  Clock,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AuthGate } from "@/components/auth-gate";
import { AppHeader } from "@/components/app-header";
import { useSession, useProfile } from "@/lib/use-profile";
import { getQuizAttempts, type QuizQuestion } from "@/lib/quiz.functions";

export const Route = createFileRoute("/analytics/$quizId")({
  head: () => ({ meta: [{ title: "Quiz Detail — Lecture Lab AI" }] }),
  component: () => (
    <AuthGate>
      <Page />
    </AuthGate>
  ),
});

function Page() {
  const { session } = useSession();
  const { profile } = useProfile(session);
  const navigate = useNavigate();
  useEffect(() => {
    if (profile && profile.role !== "teacher") navigate({ to: "/" });
  }, [profile, navigate]);
  if (!session || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (profile.role !== "teacher") return null;
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader role={profile.role} displayName={profile.display_name} email={profile.email} />
      <Inner />
    </div>
  );
}

function Inner() {
  const { quizId } = useParams({ from: "/analytics/$quizId" });
  const fetchFn = useServerFn(getQuizAttempts);
  const [data, setData] = useState<Awaited<ReturnType<typeof getQuizAttempts>> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchFn({ data: { quizId } })
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [fetchFn, quizId]);

  const stats = useMemo(() => {
    if (!data) return null;
    const completed = data.attempts.filter((a) => a.is_completed && a.score != null);
    const total = data.quiz.question_count || (data.quiz.questions as unknown as QuizQuestion[]).length;
    const avg = completed.length
      ? completed.reduce((s, a) => s + (a.score! / total) * 100, 0) / completed.length
      : null;
    // Per-question accuracy
    const questions = data.quiz.questions as unknown as QuizQuestion[];
    const perQ: { q: string; correct: number; total: number; idx: number }[] = questions.map(
      (q, idx) => ({ q: `Q${idx + 1}`, correct: 0, total: 0, idx }),
    );
    for (const a of completed) {
      const ans = (a.answers as unknown as { question_index: number; selected_option: string }[]) || [];
      for (const x of ans) {
        const pq = perQ[x.question_index];
        if (!pq) continue;
        pq.total++;
        if (questions[x.question_index]?.correct_answer === x.selected_option) pq.correct++;
      }
    }
    return {
      total,
      avg,
      completedCount: completed.length,
      participants: new Set(data.attempts.map((a) => a.student_id)).size,
      perQ: perQ.map((p) => ({ ...p, accuracy: p.total ? Math.round((p.correct / p.total) * 100) : 0 })),
    };
  }, [data]);

  const downloadCsv = () => {
    if (!data) return;
    const rows = [
      ["Student", "Email", "Score", "Total", "%", "Time (s)", "Tab switches", "Completed at"],
    ];
    const total = data.quiz.question_count || 1;
    for (const a of data.attempts) {
      const s = data.students[a.student_id];
      const events = Array.isArray(a.suspicious_events) ? a.suspicious_events.length : 0;
      rows.push([
        s?.display_name || "—",
        s?.email || "—",
        a.score != null ? String(a.score) : "",
        String(total),
        a.score != null ? String(Math.round((a.score / total) * 100)) : "",
        a.time_taken != null ? String(a.time_taken) : "",
        String(events),
        a.completed_at || "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.quiz.title.replace(/[^\w]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <Link to="/analytics" className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> All analytics
      </Link>

      {loading || !data ? (
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold">{data.quiz.title}</h1>
              <p className="text-sm text-slate-600 mt-1">
                Topic: {data.quiz.topic}{" "}
                {data.quiz.share_code && (
                  <span className="ml-2 font-mono text-xs px-2 py-0.5 bg-slate-100 rounded">
                    {data.quiz.share_code}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={downloadCsv}
              className="inline-flex items-center gap-1 text-sm border rounded-lg px-3 py-1.5 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatBox icon={<Users className="h-4 w-4" />} label="Participants" value={stats?.participants ?? 0} />
            <StatBox
              icon={<Trophy className="h-4 w-4" />}
              label="Avg Score"
              value={stats?.avg != null ? `${Math.round(stats.avg)}%` : "—"}
            />
            <StatBox
              icon={<Clock className="h-4 w-4" />}
              label="Completed"
              value={`${stats?.completedCount ?? 0}/${data.attempts.length}`}
            />
          </div>

          <div className="bg-white border rounded-2xl p-4">
            <h2 className="font-semibold mb-3">Question Accuracy</h2>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={stats?.perQ ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef" />
                  <XAxis dataKey="q" />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip />
                  <Bar dataKey="accuracy" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="text-left p-3">Student</th>
                  <th className="text-right p-3">Score</th>
                  <th className="text-right p-3">Time</th>
                  <th className="text-right p-3">Tab switches</th>
                  <th className="text-left p-3">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.attempts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      No attempts yet
                    </td>
                  </tr>
                )}
                {data.attempts.map((a) => {
                  const s = data.students[a.student_id];
                  const events = Array.isArray(a.suspicious_events) ? a.suspicious_events.length : 0;
                  const total = data.quiz.question_count || 1;
                  return (
                    <tr key={a.id}>
                      <td className="p-3">
                        <div className="font-medium">{s?.display_name || "Anonymous"}</div>
                        <div className="text-xs text-slate-500">{s?.email}</div>
                      </td>
                      <td className="p-3 text-right">
                        {a.score != null
                          ? `${a.score}/${total} (${Math.round((a.score / total) * 100)}%)`
                          : a.is_completed
                            ? "—"
                            : "In progress"}
                      </td>
                      <td className="p-3 text-right text-slate-600">
                        {a.time_taken != null ? `${Math.floor(a.time_taken / 60)}m ${a.time_taken % 60}s` : "—"}
                      </td>
                      <td className="p-3 text-right">
                        {events > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <AlertTriangle className="h-3 w-3" /> {events}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 text-xs">
                        {a.completed_at ? new Date(a.completed_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white border rounded-2xl p-4 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-indigo-100 text-indigo-700 grid place-items-center">{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}
