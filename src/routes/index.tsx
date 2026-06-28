import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  PlusCircle,
  BookOpen,
  TrendingUp,
  Users,
  ClipboardList,
  Wand2,
  Hash,
  Trophy,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AuthGate } from "@/components/auth-gate";
import { AppHeader } from "@/components/app-header";
import { useSession, useProfile } from "@/lib/use-profile";
import { Button } from "@/components/ui/button";
import { getTeacherDashboard, getStudentDashboard } from "@/lib/quiz.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Lecture Lab AI" },
      {
        name: "description",
        content: "Your teaching or learning dashboard. Generate activities, create quizzes, track progress.",
      },
    ],
  }),
  component: () => (
    <AuthGate>
      <DashboardRouter />
    </AuthGate>
  ),
});

function DashboardRouter() {
  const { session } = useSession();
  const { profile, loading } = useProfile(session);
  if (!session || loading || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader role={profile.role} displayName={profile.display_name} email={profile.email} />
      {profile.role === "teacher" ? (
        <TeacherDashboard displayName={profile.display_name} />
      ) : (
        <StudentDashboard displayName={profile.display_name} />
      )}
    </div>
  );
}

// ============== TEACHER ==============
function TeacherDashboard({ displayName }: { displayName: string | null }) {
  const fetchFn = useServerFn(getTeacherDashboard);
  const [data, setData] = useState<Awaited<ReturnType<typeof getTeacherDashboard>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFn()
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [fetchFn]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {displayName || "Teacher"} 👋</h1>
        <p className="text-slate-600 mt-1">Manage your quizzes and track student progress.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Total Quizzes"
          value={data?.totalQuizzes ?? 0}
          color="bg-indigo-100 text-indigo-700"
          loading={loading}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Students"
          value={data?.totalStudents ?? 0}
          color="bg-fuchsia-100 text-fuchsia-700"
          loading={loading}
        />
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Avg Score"
          value={data?.avgScore != null ? `${Math.round(data.avgScore)}%` : "—"}
          color="bg-emerald-100 text-emerald-700"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QuickAction
          to="/quiz/new"
          icon={<PlusCircle className="h-5 w-5" />}
          title="Create Quiz"
          desc="Build a quiz from a document"
        />
        <QuickAction
          to="/analytics"
          icon={<TrendingUp className="h-5 w-5" />}
          title="View Analytics"
          desc="See per-quiz student results"
        />
        <QuickAction
          to="/lab"
          icon={<Wand2 className="h-5 w-5" />}
          title="Generate Activities"
          desc="13 activity modes from any document"
        />
      </div>

      <div className="bg-white border rounded-2xl shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Recent Student Activity</h2>
        </div>
        <div className="p-4">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          ) : !data?.recent.length ? (
            <p className="text-sm text-slate-500">
              No attempts yet. Create a quiz and share the code with your students.
            </p>
          ) : (
            <ul className="divide-y">
              {data.recent.map((r, i) => (
                <li key={i} className="py-3 flex items-center justify-between gap-4 text-sm">
                  <div className="flex-1 truncate">
                    <div className="font-medium truncate">
                      {data.quizMap[r.quiz_id] || "Quiz"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {r.completed_at ? new Date(r.completed_at).toLocaleString() : "In progress"}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">
                    {r.score != null ? `Score: ${r.score}` : "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="text-center">
        <Link to="/analytics" className="text-sm text-indigo-600 hover:underline">
          View all quizzes & detailed analytics →
        </Link>
      </div>
    </div>
  );
}

// ============== STUDENT ==============
function StudentDashboard({ displayName }: { displayName: string | null }) {
  const fetchFn = useServerFn(getStudentDashboard);
  const [data, setData] = useState<Awaited<ReturnType<typeof getStudentDashboard>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchFn()
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [fetchFn]);

  const joinByCode = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4) return;
    navigate({ to: "/quiz/$code", params: { code: c } });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hi, {displayName || "Student"} 🎓</h1>
        <p className="text-slate-600 mt-1">Attempt quizzes, practice independently, track your growth.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Quizzes Attempted"
          value={data?.totalAttempted ?? 0}
          color="bg-indigo-100 text-indigo-700"
          loading={loading}
        />
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Avg Score"
          value={data?.avgPct != null ? `${Math.round(data.avgPct)}%` : "—"}
          color="bg-emerald-100 text-emerald-700"
          loading={loading}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Pending"
          value={data?.pendingCount ?? 0}
          color="bg-amber-100 text-amber-700"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 font-semibold">
            <Hash className="h-4 w-4 text-indigo-600" /> Join Quiz by Code
          </div>
          <p className="text-xs text-slate-500 mt-1">Enter the 6-character code your teacher shared.</p>
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              className="flex-1 px-3 py-2 border rounded-lg uppercase tracking-widest font-mono focus:ring-2 focus:ring-indigo-200 outline-none"
            />
            <Button onClick={joinByCode} className="bg-indigo-600 hover:bg-indigo-700">
              Join
            </Button>
          </div>
        </div>
        <QuickAction
          to="/quiz/new"
          icon={<BookOpen className="h-5 w-5" />}
          title="Create Practice Quiz"
          desc="Self-test on any uploaded document"
        />
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-4">
        <h2 className="font-semibold mb-3">Performance Trend</h2>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : !data?.trend.length ? (
          <p className="text-sm text-slate-500">Complete a few quizzes to see your trend.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef" />
                <XAxis dataKey="index" />
                <YAxis domain={[0, 100]} unit="%" />
                <Tooltip />
                <Line type="monotone" dataKey="pct" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border rounded-2xl shadow-sm">
          <div className="p-4 border-b font-semibold">Quiz History</div>
          <div className="p-4">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : !data?.attempts.length ? (
              <p className="text-sm text-slate-500">No attempts yet.</p>
            ) : (
              <ul className="divide-y">
                {data.attempts.slice(0, 8).map((a) => {
                  const meta = data.quizMap[a.quiz_id];
                  const qc = meta?.question_count || 1;
                  const pct = a.score != null ? Math.round((a.score / qc) * 100) : null;
                  const events = Array.isArray(a.suspicious_events) ? a.suspicious_events.length : 0;
                  return (
                    <li key={a.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                      <div className="flex-1 truncate">
                        <div className="font-medium truncate">{meta?.title || "Quiz"}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          {meta?.is_practice && (
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded">Practice</span>
                          )}
                          {a.completed_at
                            ? new Date(a.completed_at).toLocaleDateString()
                            : "In progress"}
                          {events > 0 && (
                            <span
                              className="inline-flex items-center gap-1 text-amber-600"
                              title="Tab-switch events"
                            >
                              <AlertTriangle className="h-3 w-3" /> {events}
                            </span>
                          )}
                        </div>
                      </div>
                      {a.is_completed ? (
                        <span className="font-semibold">{pct}%</span>
                      ) : (
                        <Link
                          to="/quiz/$code"
                          params={{ code: a.quiz_id }}
                          search={{ aid: a.id } as never}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Resume →
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm">
          <div className="p-4 border-b font-semibold">My Practice Quizzes</div>
          <div className="p-4">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : !data?.practiceQuizzes.length ? (
              <p className="text-sm text-slate-500">
                You haven&apos;t created any practice quizzes yet.{" "}
                <Link to="/quiz/new" className="text-indigo-600 hover:underline">
                  Create one →
                </Link>
              </p>
            ) : (
              <ul className="divide-y">
                {data.practiceQuizzes.map((q) => (
                  <li key={q.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <div className="flex-1 truncate">
                      <div className="font-medium truncate">{q.title}</div>
                      <div className="text-xs text-slate-500">{q.question_count} questions</div>
                    </div>
                    <Link
                      to="/quiz/$code"
                      params={{ code: q.id }}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Take →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-4 flex items-center gap-3">
      <div className={`h-10 w-10 grid place-items-center rounded-xl ${color}`}>{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-2xl font-bold">
          {loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : value}
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="block bg-white border rounded-2xl shadow-sm p-4 hover:border-indigo-300 hover:shadow transition"
    >
      <div className="flex items-center gap-2 font-semibold">
        <span className="text-indigo-600">{icon}</span> {title}
      </div>
      <p className="text-xs text-slate-500 mt-1">{desc}</p>
    </Link>
  );
}
