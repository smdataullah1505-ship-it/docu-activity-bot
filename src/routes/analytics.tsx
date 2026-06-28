import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { AppHeader } from "@/components/app-header";
import { useSession, useProfile } from "@/lib/use-profile";
import { listMyQuizzesWithStats } from "@/lib/quiz.functions";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Lecture Lab AI" }] }),
  component: () => (
    <AuthGate>
      <AnalyticsPage />
    </AuthGate>
  ),
});

function AnalyticsPage() {
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
  const fetchFn = useServerFn(listMyQuizzesWithStats);
  const [data, setData] = useState<Awaited<ReturnType<typeof listMyQuizzesWithStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    fetchFn()
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [fetchFn]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <Link to="/" className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Dashboard
      </Link>
      <h1 className="text-2xl font-bold">Quiz Analytics</h1>
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      ) : !data?.quizzes.length ? (
        <div className="bg-white border rounded-2xl p-6 text-sm text-slate-600">
          You haven&apos;t created any quizzes yet.{" "}
          <Link to="/quiz/new" className="text-indigo-600 hover:underline">
            Create your first quiz →
          </Link>
        </div>
      ) : (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left p-3">Quiz</th>
                <th className="text-left p-3 hidden sm:table-cell">Topic</th>
                <th className="text-left p-3 hidden md:table-cell">Code</th>
                <th className="text-right p-3">Attempts</th>
                <th className="text-right p-3">Avg Score</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.quizzes.map((q) => {
                const s = data.stats[q.id] || { attempts: 0, avg: null, completed: 0 };
                const avgPct =
                  s.avg != null && q.question_count
                    ? Math.round((s.avg / q.question_count) * 100)
                    : null;
                return (
                  <tr key={q.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-medium">{q.title}</div>
                      <div className="text-xs text-slate-500">
                        {q.is_practice ? "Practice" : q.is_published ? "Published" : "Draft"}
                        {" · "}
                        {q.question_count} q
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell text-slate-600 truncate max-w-xs">{q.topic}</td>
                    <td className="p-3 hidden md:table-cell font-mono text-xs">
                      {q.share_code ? (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(q.share_code!);
                            setCopied(q.id);
                            setTimeout(() => setCopied(null), 1200);
                          }}
                          className="inline-flex items-center gap-1 hover:text-indigo-600"
                        >
                          {q.share_code}
                          {copied === q.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 text-right">{s.attempts}</td>
                    <td className="p-3 text-right">
                      {avgPct != null ? `${avgPct}%` : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        to="/analytics/$quizId"
                        params={{ quizId: q.id }}
                        className="text-indigo-600 hover:underline text-xs inline-flex items-center gap-1"
                      >
                        Detail <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
