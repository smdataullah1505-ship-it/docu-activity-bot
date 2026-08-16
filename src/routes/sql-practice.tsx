import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Database, Loader2, Printer, RefreshCw, Sparkles } from "lucide-react";
import { generateSqlMcqs } from "@/lib/sql-mcq.functions";
import { getCachedActivity, saveCachedActivity } from "@/lib/activity-cache.functions";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getGeminiKey } from "@/lib/user-api-key";
import { MCQView } from "./index";

export const Route = createFileRoute("/sql-practice")({
  head: () => ({
    meta: [
      { title: "SQL Practice — Query-Based SQL Interview MCQs" },
      {
        name: "description",
        content:
          "Generate query-based SQL interview multiple-choice questions on any topic. Pick 5, 10 or 20 questions and easy, medium, hard or mixed difficulty. No document upload needed.",
      },
      { property: "og:title", content: "SQL Practice — Query-Based SQL Interview MCQs" },
      {
        property: "og:description",
        content:
          "Practise query-based SQL interview MCQs on any topic, with instant answer checking and explanations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SqlPractice,
});

type Difficulty = "easy" | "medium" | "hard" | "mixed";
type QCount = 5 | 10 | 20;

// The standalone tool has no uploaded document, so cached rows are keyed on a
// fixed sentinel hash instead of a document hash.
const STANDALONE_SQL_HASH = "standalone-sql-practice";

function SqlPractice() {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState<QCount>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>("mixed");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [activeTopic, setActiveTopic] = useState("");

  const generateSqlMcqsFn = useServerFn(generateSqlMcqs);
  const getCachedActivityFn = useServerFn(getCachedActivity);
  const saveCachedActivityFn = useServerFn(saveCachedActivity);

  useEffect(() => {
    document.title = "SQL Practice — Query-Based SQL Interview MCQs";
  }, []);

  const run = async (forceRegenerate = false) => {
    const t = topic.trim();
    if (!t) {
      toast.error("Enter a topic first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setFromCache(false);
    setActiveTopic(t);
    try {
      if (!forceRegenerate) {
        try {
          const cached = await getCachedActivityFn({
            data: {
              documentHash: STANDALONE_SQL_HASH,
              topic: t,
              activityType: "sqlMcqs",
              difficulty,
              questionCount: count,
            },
          });
          if (cached.hit) {
            setResult(cached.generatedJson as Record<string, unknown>);
            setFromCache(true);
            setLoading(false);
            return;
          }
        } catch {
          /* cache lookup failure — generate fresh */
        }
      }

      const { json } = await generateSqlMcqsFn({
        data: { topic: t, count, difficulty, userApiKey: getGeminiKey() || undefined },
      });
      const parsed = JSON.parse(json);

      try {
        await saveCachedActivityFn({
          data: {
            documentName: "SQL Practice",
            documentHash: STANDALONE_SQL_HASH,
            topic: t,
            activityType: "sqlMcqs",
            difficulty,
            questionCount: count,
            generatedJson: parsed,
            replace: forceRegenerate,
          },
        });
      } catch (e) {
        console.warn("Cache save failed", e);
      }

      setResult(parsed);
    } catch (err) {
      let msg = err instanceof Error ? err.message : "Generation failed.";
      if (!getGeminiKey() && /429|too many requests|usage limit|quota/i.test(msg)) {
        msg = "You've reached the free usage limit. Please add your own Gemini API key to continue.";
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />

      <header className="no-print border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-hero text-primary-foreground shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Lecture Lab AI</h1>
              <p className="text-xs text-muted-foreground">SQL Practice — standalone tool</p>
            </div>
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← Activity generator
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6">
        <section className="no-print surface-elevated p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl gradient-hero text-primary-foreground shadow">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-2xl font-bold">SQL Practice</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                General query-based SQL interview MCQs on any topic you enter. This tool does not use
                your uploaded lecture material.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="text-sm font-medium" htmlFor="sql-topic">
                Topic
              </label>
              <Input
                id="sql-topic"
                className="mt-2"
                placeholder="e.g. Joins and subqueries"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) run(false);
                }}
                maxLength={200}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Difficulty</p>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {(["easy", "medium", "hard", "mixed"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`rounded-md border px-2 py-1.5 text-xs font-semibold capitalize transition ${
                        difficulty === d
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium">Number of questions</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([5, 10, 20] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      className={`rounded-md border px-2 py-1.5 text-xs font-semibold transition ${
                        count === n
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={loading || !topic.trim()} onClick={() => run(false)}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
                  </>
                ) : (
                  "Generate questions"
                )}
              </Button>
              {result && (
                <>
                  <Button variant="outline" disabled={loading} onClick={() => run(true)}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
                  </Button>
                  <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" /> Print / PDF
                  </Button>
                </>
              )}
              {result && fromCache && (
                <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Database className="h-3.5 w-3.5" /> Loaded from cache
                </span>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="no-print mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-5">
            <p className="text-sm font-medium text-destructive">{error}</p>
            <Button className="mt-3" variant="outline" onClick={() => run(true)}>
              <RefreshCw className="mr-2 h-4 w-4" /> Try again
            </Button>
          </div>
        )}

        {loading && (
          <div className="no-print mt-8 flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Writing {count} {difficulty} SQL questions…
          </div>
        )}

        {result && (
          <div className="mt-8">
            <p className="no-print mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Topic · {activeTopic}
            </p>
            <MCQView data={result} sql />
          </div>
        )}
      </main>
    </div>
  );
}
