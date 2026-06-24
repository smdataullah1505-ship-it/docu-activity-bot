import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Sparkles,
  RefreshCw,
  ListChecks,
  Brain,
  Lightbulb,
  MessageSquare,
  Hammer,
  Globe2,
  HelpCircle,
  AlertTriangle,
  Printer,
  ArrowRight,
  Loader2,
  Check,
  X,
  FileType2,
  Database,
  Eye,
  ImageIcon,
  BarChart3,
  SlidersHorizontal,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { extractTopics, generateActivity } from "@/lib/activities.functions";
import {
  generateImageQuestion,
  generateChartActivity,
  generateBeforeAfter,
} from "@/lib/visual-activities.functions";
import { saveCachedActivity } from "@/lib/activity-cache.functions";
import { extractTextFromFile } from "@/lib/parse-document";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lecture Lab AI — Classroom Activity Generator" },
      {
        name: "description",
        content:
          "Upload PDF, DOCX, PPTX, or TXT lecture material. Generate interactive quizzes, flashcards, debates, simulations, and more — grounded in your own content.",
      },
    ],
  }),
  component: LectureLab,
});

type Step = "upload" | "topics" | "activity" | "results";

type ActivityKey =
  | "quickRecap"
  | "mcqs"
  | "fillBlanks"
  | "flashcards"
  | "socraticQuestions"
  | "debates"
  | "workshops"
  | "examples"
  | "reverseQuestions"
  | "findMistakes";

const MODES: {
  key: ActivityKey;
  title: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "quickRecap", title: "Quick Recap", blurb: "Last-5-minutes revision pack", icon: RefreshCw },
  { key: "mcqs", title: "MCQ Generator", blurb: "Easy / Medium / Hard MCQs", icon: ListChecks },
  { key: "fillBlanks", title: "Fill in the Blanks", blurb: "Terminology-driven blanks", icon: FileType2 },
  { key: "flashcards", title: "Flashcards", blurb: "Term & concept cards", icon: Brain },
  { key: "socraticQuestions", title: "Socratic Questions", blurb: "Why / how / reasoning", icon: Lightbulb },
  { key: "debates", title: "Debate Prompts", blurb: "Seminar discussion topics", icon: MessageSquare },
  { key: "workshops", title: "Workshops", blurb: "In-class simulations", icon: Hammer },
  { key: "examples", title: "Real-World Examples", blurb: "Applied scenarios", icon: Globe2 },
  { key: "reverseQuestions", title: "Reverse Questioning", blurb: "Questions students may ask", icon: HelpCircle },
  { key: "findMistakes", title: "Find the Mistake", blurb: "Spot & correct errors", icon: AlertTriangle },
];

type CacheMeta = { source: "cache" | "fresh"; createdAt: string } | null;

const STORAGE_KEY = "lecturelab.session.v2";

type PersistedState = {
  step: Step;
  fileName: string;
  documentText: string;
  topics: string[];
  selectedTopic: string;
  selectedMode: ActivityKey | null;
  mcqDifficulty: "easy" | "medium" | "hard" | "mixed";
  mcqCount: 5 | 10 | 20;
};

function loadPersisted(): Partial<PersistedState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedState>;
  } catch {
    return {};
  }
}

function LectureLab() {
  const persisted = useMemo(() => loadPersisted(), []);
  const [step, setStep] = useState<Step>(persisted.step ?? "upload");
  const [fileName, setFileName] = useState<string>(persisted.fileName ?? "");
  const [documentText, setDocumentText] = useState<string>(persisted.documentText ?? "");
  const [topics, setTopics] = useState<string[]>(persisted.topics ?? []);
  const [selectedTopic, setSelectedTopic] = useState<string>(persisted.selectedTopic ?? "");
  const [selectedMode, setSelectedMode] = useState<ActivityKey | null>(persisted.selectedMode ?? null);

  const [mcqDifficulty, setMcqDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">(
    persisted.mcqDifficulty ?? "mixed",
  );
  const [mcqCount, setMcqCount] = useState<5 | 10 | 20>(persisted.mcqCount ?? 10);

  const [parsing, setParsing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [cacheMeta, setCacheMeta] = useState<CacheMeta>(null);

  // Persist session state to localStorage so refreshes / remounts don't lose progress.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const payload: PersistedState = {
        step,
        fileName,
        documentText,
        topics,
        selectedTopic,
        selectedMode,
        mcqDifficulty,
        mcqCount,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota / serialization errors are non-fatal */
    }
  }, [step, fileName, documentText, topics, selectedTopic, selectedMode, mcqDifficulty, mcqCount]);

  const extractTopicsFn = useServerFn(extractTopics);
  const generateActivityFn = useServerFn(generateActivity);
  const saveCachedActivityFn = useServerFn(saveCachedActivity);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        setParsing(true);
        setFileName(file.name);
        const text = await extractTextFromFile(file);
        if (!text || text.trim().length < 50) {
          toast.error("Couldn't read enough text from this file. Try another document.");
          setParsing(false);
          return;
        }
        setDocumentText(text);
        setParsing(false);
        setExtracting(true);
        const { topics } = await extractTopicsFn({ data: { documentText: text } });
        setTopics(topics);
        setExtracting(false);
        setStep("topics");
      } catch (err) {
        setParsing(false);
        setExtracting(false);
        const msg = err instanceof Error ? err.message : "Failed to process the file.";
        toast.error(msg);
      }
    },
    [extractTopicsFn],
  );

  const onPickFile = () => fileInputRef.current?.click();

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setStep("upload");
    setFileName("");
    setDocumentText("");
    setTopics([]);
    setSelectedTopic("");
    setSelectedMode(null);
    setResult(null);
    setCacheMeta(null);
    setGenerationError(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  };

  const runGeneration = async (mode: ActivityKey, forceRegenerate = false) => {
    if (!selectedTopic) return;
    try {
      setSelectedMode(mode);
      setGenerating(true);
      setGenerationError(null);
      setResult(null);
      setCacheMeta(null);
      setStep("results");

      const difficulty = mode === "mcqs" ? mcqDifficulty : null;
      const questionCount = mode === "mcqs" ? mcqCount : null;

      // 1. Check cache first
      if (!forceRegenerate) {
        let q = supabase
          .from("generated_activities")
          .select("generated_json, created_at")
          .eq("topic", selectedTopic)
          .eq("activity_type", mode)
          .order("created_at", { ascending: false })
          .limit(1);
        q = difficulty ? q.eq("difficulty", difficulty) : q.is("difficulty", null);
        q = questionCount ? q.eq("question_count", questionCount) : q.is("question_count", null);
        const { data: cached } = await q;
        if (cached && cached.length > 0) {
          setResult(cached[0].generated_json as Record<string, unknown>);
          setCacheMeta({ source: "cache", createdAt: cached[0].created_at });
          setGenerating(false);
          return;
        }
      }

      // 2. Otherwise generate fresh
      const options: Record<string, unknown> = {};
      if (mode === "mcqs") {
        options.difficulty = mcqDifficulty;
        options.count = mcqCount;
      }
      if (mode === "reverseQuestions") {
        // Auto-use the selected topic as the concept — no separate input needed.
        options.concept = selectedTopic;
      }
      const { json } = await generateActivityFn({
        data: { documentText, topic: selectedTopic, mode, options },
      });
      const parsed = JSON.parse(json);

      // 3. Save to cache (best-effort)
      const nowIso = new Date().toISOString();
      try {
        await saveCachedActivityFn({
          data: {
            documentName: fileName,
            topic: selectedTopic,
            activityType: mode,
            difficulty,
            questionCount,
            generatedJson: parsed,
            replace: forceRegenerate,
          },
        });
      } catch (e) {
        console.warn("Cache save failed", e);
      }

      setResult(parsed);
      setCacheMeta({ source: "fresh", createdAt: nowIso });
      setGenerating(false);
    } catch (err) {
      setGenerating(false);
      const msg = err instanceof Error ? err.message : "Generation failed.";
      setGenerationError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen">
      <Toaster richColors position="top-center" />
      <Header onReset={reset} />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
        <Stepper step={step} />

        {step === "upload" && (
          <UploadStep
            parsing={parsing}
            extracting={extracting}
            dragOver={dragOver}
            setDragOver={setDragOver}
            onPickFile={onPickFile}
            onDrop={onDrop}
            fileInputRef={fileInputRef}
            handleFile={handleFile}
            fileName={fileName}
          />
        )}

        {step === "topics" && (
          <TopicsStep
            fileName={fileName}
            topics={topics}
            selectedTopic={selectedTopic}
            onSelect={(t) => {
              setSelectedTopic(t);
              setStep("activity");
            }}
            onBack={() => setStep("upload")}
          />
        )}

        {step === "activity" && (
          <ActivityStep
            topic={selectedTopic}
            mcqDifficulty={mcqDifficulty}
            setMcqDifficulty={setMcqDifficulty}
            mcqCount={mcqCount}
            setMcqCount={setMcqCount}
            onRun={(m) => runGeneration(m, false)}
            onBack={() => setStep("topics")}
          />
        )}

        {step === "results" && (
          <ResultsStep
            topic={selectedTopic}
            mode={selectedMode}
            generating={generating}
            error={generationError}
            result={result}
            cacheMeta={cacheMeta}
            onBack={() => setStep("activity")}
            onRegenerate={() => selectedMode && runGeneration(selectedMode, true)}
          />
        )}
      </main>
    </div>
  );
}

function Header({ onReset }: { onReset: () => void }) {
  return (
    <header className="no-print border-b border-border/60 bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <button onClick={onReset} className="flex items-center gap-3 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-hero text-primary-foreground shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Lecture Lab AI</h1>
            <p className="text-xs text-muted-foreground">Classroom activities from your lecture material</p>
          </div>
        </button>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onReset();
          }}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          New session
        </a>
      </div>
    </header>
  );
}

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "topics", label: "Topics" },
  { key: "activity", label: "Activity" },
  { key: "results", label: "Results" },
];

function Stepper({ step }: { step: Step }) {
  const idx = STEPS.findIndex((s) => s.key === step);
  const current = STEPS[idx];
  return (
    <div className="no-print mb-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Step {idx + 1} of {STEPS.length} · {current?.label}
      </p>
      <ol className="flex items-center gap-2 overflow-x-auto py-2">
        {STEPS.map((s, i) => {
          const active = i === idx;
          const done = i < idx;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "bg-accent text-accent-foreground ring-4 ring-accent/30"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border sm:w-10" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function UploadStep({
  parsing,
  extracting,
  dragOver,
  setDragOver,
  onPickFile,
  onDrop,
  fileInputRef,
  handleFile,
  fileName,
}: {
  parsing: boolean;
  extracting: boolean;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onPickFile: () => void;
  onDrop: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFile: (file: File) => void;
  fileName: string;
}) {
  const busy = parsing || extracting;
  return (
    <section className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
      <div>
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-foreground">
          <Sparkles className="h-3.5 w-3.5" /> Grounded in your material
        </p>
        <h2 className="text-4xl font-bold leading-tight sm:text-5xl">
          Turn lecture notes into <span className="italic text-primary">classroom-ready</span> activities.
        </h2>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          Upload your PPT, PDF, DOCX, or TXT. Lecture Lab AI extracts the topics and generates MCQs, flashcards,
          debates, simulations and more — using only what's in your document.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-8 rounded-2xl border-2 border-dashed p-8 transition ${
            dragOver ? "border-primary bg-primary/5" : "border-border bg-card/60"
          } ${busy ? "pointer-events-none opacity-80" : ""}`}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-hero text-primary-foreground shadow-md">
              {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-base font-semibold">
                {parsing
                  ? `Reading ${fileName}…`
                  : extracting
                    ? "Extracting topics from your material…"
                    : "Drop your lecture file here"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">PDF, DOCX, PPTX or TXT · up to ~20MB</p>
            </div>
            <Button onClick={onPickFile} disabled={busy} size="lg">
              <Upload className="mr-2 h-4 w-4" /> Choose file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </div>

      <aside className="surface-elevated p-6">
        <h3 className="text-lg font-semibold">What you'll get</h3>
        <ul className="mt-4 grid gap-3 text-sm">
          {MODES.slice(0, 6).map((m) => (
            <li key={m.key} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-accent/40 text-accent-foreground">
                <m.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="font-medium">{m.title}</p>
                <p className="text-muted-foreground">{m.blurb}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Everything is generated strictly from your uploaded document — no external knowledge.
        </p>
      </aside>
    </section>
  );
}

function TopicsStep({
  fileName,
  topics,
  selectedTopic,
  onSelect,
  onBack,
}: {
  fileName: string;
  topics: string[];
  selectedTopic: string;
  onSelect: (t: string) => void;
  onBack: () => void;
}) {
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Pick a topic</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Extracted from <span className="font-medium text-foreground">{fileName}</span> · {topics.length} topics
          </p>
        </div>
        <Button variant="ghost" onClick={onBack}>
          <X className="mr-2 h-4 w-4" /> Use a different file
        </Button>
      </div>

      {topics.length === 0 ? (
        <div className="surface-card p-8 text-center text-muted-foreground">
          No topics were extracted. Try a more detailed document.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((t, i) => {
            const active = t === selectedTopic;
            return (
              <button
                key={`${t}-${i}`}
                onClick={() => onSelect(t)}
                className={`group flex items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md ${
                  active ? "border-primary ring-2 ring-primary/30" : "border-border"
                }`}
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/40 text-xs font-bold text-accent-foreground">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-medium leading-snug">{t}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ActivityStep({
  topic,
  mcqDifficulty,
  setMcqDifficulty,
  mcqCount,
  setMcqCount,
  onRun,
  onBack,
}: {
  topic: string;
  mcqDifficulty: "easy" | "medium" | "hard" | "mixed";
  setMcqDifficulty: (v: "easy" | "medium" | "hard" | "mixed") => void;
  mcqCount: 5 | 10 | 20;
  setMcqCount: (v: 5 | 10 | 20) => void;
  onRun: (mode: ActivityKey) => void;
  onBack: () => void;
}) {
  const [hovered, setHovered] = useState<ActivityKey | null>(null);
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selected topic</p>
          <h2 className="text-2xl font-bold">{topic}</h2>
        </div>
        <Button variant="ghost" onClick={onBack}>
          ← Change topic
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              onMouseEnter={() => setHovered(m.key)}
              onClick={() => onRun(m.key)}
              className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl gradient-hero text-primary-foreground shadow">
                <m.icon className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="text-base font-semibold">{m.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{m.blurb}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
            </button>
          ))}
        </div>

        <aside className="surface-elevated h-fit p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Options</h3>

          <div className="mt-4">
            <p className="text-sm font-medium">MCQ difficulty</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {(["easy", "medium", "hard", "mixed"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setMcqDifficulty(d)}
                  className={`rounded-md border px-2 py-1.5 text-xs font-semibold capitalize transition ${
                    mcqDifficulty === d
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium">MCQ count</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {([5, 10, 20] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setMcqCount(n)}
                  className={`rounded-md border px-2 py-1.5 text-xs font-semibold transition ${
                    mcqCount === n
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Reverse Questioning</span> automatically uses
            your selected topic: <span className="italic">"{topic}"</span>.
          </div>


          {hovered && (
            <p className="mt-5 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Hovering: <span className="font-medium text-foreground">{MODES.find((m) => m.key === hovered)?.title}</span>
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}

function ResultsStep({
  topic,
  mode,
  generating,
  error,
  result,
  cacheMeta,
  onBack,
  onRegenerate,
}: {
  topic: string;
  mode: ActivityKey | null;
  generating: boolean;
  error: string | null;
  result: Record<string, unknown> | null;
  cacheMeta: CacheMeta;
  onBack: () => void;
  onRegenerate: () => void;
}) {
  const meta = MODES.find((m) => m.key === mode);
  return (
    <section>
      <div className="no-print mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {meta?.title} · {topic}
          </p>
          <h2 className="text-2xl font-bold">Your activity</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            ← Back
          </Button>
          <Button variant="outline" onClick={onRegenerate} disabled={generating}>
            <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
          </Button>
          <Button onClick={() => window.print()} disabled={generating || !result}>
            <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {cacheMeta && !generating && !error && (
        <div
          className={`no-print mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
            cacheMeta.source === "cache"
              ? "bg-accent/30 text-accent-foreground"
              : "bg-primary/15 text-primary"
          }`}
        >
          {cacheMeta.source === "cache" ? (
            <>
              <Database className="h-3.5 w-3.5" /> 📦 Loaded from cache
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" /> ✨ Newly generated
            </>
          )}
          <span className="text-muted-foreground">· {new Date(cacheMeta.createdAt).toLocaleString()}</span>
        </div>
      )}

      {generating && (
        <div className="surface-card flex items-center gap-4 p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <div>
            <p className="font-medium">Generating activity from your material…</p>
            <p className="text-sm text-muted-foreground">This usually takes a few seconds.</p>
          </div>
        </div>
      )}

      {!generating && error && (
        <div className="surface-card border border-danger/40 bg-danger/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-danger" />
            <div className="flex-1">
              <p className="font-semibold text-danger">Generation failed</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" onClick={onRegenerate}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {!generating && !error && result && mode && (
        <ResultRenderer mode={mode} data={result} topic={topic} />
      )}
    </section>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="surface-card mb-5 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

type AnyObj = Record<string, unknown>;

function asArr<T = AnyObj>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function ResultRenderer({ mode, data, topic }: { mode: ActivityKey; data: AnyObj; topic: string }) {
  const payload = (data[mode] ?? data) as AnyObj;

  return (
    <div className="results">
      <div className="surface-elevated mb-6 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Topic</p>
        <p className="text-xl font-bold">{topic}</p>
      </div>

      {mode === "quickRecap" && <QuickRecapView data={payload} />}
      {mode === "mcqs" && <MCQView data={payload} />}
      {mode === "fillBlanks" && <FillBlanksView data={asArr(payload) ?? asArr(data.fillBlanks)} />}
      {mode === "flashcards" && <FlashcardsView data={asArr(payload) ?? asArr(data.flashcards)} />}
      {mode === "socraticQuestions" && (
        <SocraticView data={asArr(payload) ?? asArr(data.socraticQuestions)} />
      )}
      {mode === "debates" && <DebatesView data={asArr(payload) ?? asArr(data.debates)} />}
      {mode === "workshops" && <WorkshopsView data={asArr(payload) ?? asArr(data.workshops)} />}
      {mode === "examples" && <ExamplesView data={asArr(payload) ?? asArr(data.examples)} />}
      {mode === "reverseQuestions" && (
        <ReverseView data={asArr(payload) ?? asArr(data.reverseQuestions)} />
      )}
      {mode === "findMistakes" && <FindMistakesView data={asArr(payload) ?? asArr(data.findMistakes)} />}
    </div>
  );
}

/* ---------- Reusable answer-reveal helpers ---------- */

function RevealAnswer({
  label = "Show answer",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);
  if (!shown) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="no-print mt-3"
        onClick={() => setShown(true)}
      >
        <Eye className="mr-2 h-4 w-4" /> {label}
      </Button>
    );
  }
  return <div className="mt-3">{children}</div>;
}

/* ---------- Quick Recap (interactive) ---------- */

function QuickRecapView({ data }: { data: AnyObj }) {
  const keyPoints = asArr<string>(data.keyPoints);
  const concepts = asArr<{ concept: string; explanation: string }>(data.importantConcepts);
  const oral = asArr<{ question: string; answer: string }>(data.oralQuestions);
  const triggers = asArr<string>(data.memoryTriggers);
  return (
    <>
      <Section title="Key Points">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {keyPoints.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </Section>
      <Section title="Important Concepts">
        <div className="grid gap-3 sm:grid-cols-2">
          {concepts.map((c, i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="font-semibold">{c.concept}</p>
              <RevealAnswer label="Reveal explanation">
                <p className="text-sm text-muted-foreground">{c.explanation}</p>
              </RevealAnswer>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Quick Oral Questions">
        <ol className="space-y-3">
          {oral.map((q, i) => (
            <li key={i} className="rounded-lg border border-border p-4">
              <p className="font-medium">
                <span className="mr-2 text-muted-foreground">Q{i + 1}.</span>
                {q.question}
              </p>
              <RevealAnswer>
                <p className="text-sm text-success">
                  <span className="font-semibold">Answer:</span> {q.answer}
                </p>
              </RevealAnswer>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Memory Triggers">
        <ul className="grid gap-2 sm:grid-cols-2">
          {triggers.map((t, i) => (
            <li
              key={i}
              className="rounded-lg border border-dashed border-accent/60 bg-accent/10 px-3 py-2 text-sm"
            >
              💡 {t}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

/* ---------- MCQ (interactive with score) ---------- */

function difficultyColor(d: "easy" | "medium" | "hard"): string {
  if (d === "easy") return "bg-[oklch(0.92_0.1_145)] text-[oklch(0.3_0.12_145)]";
  if (d === "medium") return "bg-[oklch(0.92_0.12_70)] text-[oklch(0.35_0.15_55)]";
  return "bg-[oklch(0.92_0.1_25)] text-[oklch(0.4_0.18_25)]";
}

type MCQ = {
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  reference?: string;
};

function MCQView({ data }: { data: AnyObj }) {
  const all = useMemo(() => {
    const items: { q: MCQ; diff: "easy" | "medium" | "hard"; idx: number }[] = [];
    (["easy", "medium", "hard"] as const).forEach((diff) => {
      asArr<MCQ>(data[diff]).forEach((q, i) => items.push({ q, diff, idx: i }));
    });
    return items;
  }, [data]);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  if (all.length === 0) {
    return (
      <div className="surface-card p-6 text-center text-muted-foreground">
        No MCQs were generated for this topic.
      </div>
    );
  }

  const score = all.reduce(
    (acc, { q }, i) => acc + (submitted && answers[i] === q.correct ? 1 : 0),
    0,
  );
  const allAnswered = all.every((_, i) => answers[i] != null);

  return (
    <Section
      title={`MCQs (${all.length})`}
      right={
        submitted ? (
          <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
            Score: {score} / {all.length}
          </span>
        ) : null
      }
    >
      <ol className="space-y-4">
        {all.map(({ q, diff }, i) => {
          const picked = answers[i];
          const isRight = picked === q.correct;
          return (
            <li key={i} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${difficultyColor(diff)}`}>
                  {diff}
                </span>
                <span className="text-xs text-muted-foreground">Q{i + 1}</span>
              </div>
              <p className="font-medium">{q.question}</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options?.map((opt, j) => {
                  const selected = picked === opt;
                  const showCorrect = submitted && opt === q.correct;
                  const showWrong = submitted && selected && opt !== q.correct;
                  return (
                    <li key={j}>
                      <button
                        type="button"
                        disabled={submitted}
                        onClick={() => setAnswers((a) => ({ ...a, [i]: opt }))}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                          showCorrect
                            ? "border-success bg-success/10 font-medium"
                            : showWrong
                              ? "border-danger bg-danger/10"
                              : selected
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                        } ${submitted ? "cursor-default" : "cursor-pointer"}`}
                      >
                        <span className="mr-2 text-muted-foreground">{String.fromCharCode(65 + j)}.</span>
                        {opt}
                        {showCorrect && <Check className="ml-2 inline h-4 w-4 text-success" />}
                        {showWrong && <X className="ml-2 inline h-4 w-4 text-danger" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {submitted && (
                <div className="mt-3 space-y-2">
                  <div
                    className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                      isRight ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                    }`}
                  >
                    {isRight ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {isRight
                        ? "Correct!"
                        : "Incorrect."}{" "}
                      <span className="font-normal text-foreground">
                        Correct answer: <span className="font-semibold">{q.correct}</span>
                      </span>
                    </span>
                  </div>
                  {q.explanation && (
                    <p className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">
                      <span className="font-semibold">Explanation:</span> {q.explanation}
                    </p>
                  )}
                  {q.reference && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold">Reference:</span> {q.reference}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="no-print mt-5 flex flex-wrap items-center gap-3">
        {!submitted ? (
          <Button onClick={() => setSubmitted(true)} disabled={!allAnswered}>
            <Check className="mr-2 h-4 w-4" /> Submit answers
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              setSubmitted(false);
              setAnswers({});
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        )}
        {!submitted && !allAnswered && (
          <span className="text-sm text-muted-foreground">
            Answer all {all.length} questions to submit.
          </span>
        )}
      </div>
    </Section>
  );
}

/* ---------- Fill in the Blanks (interactive) ---------- */

function FillBlanksView({ data }: { data: AnyObj[] }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);

  if (data.length === 0) {
    return <div className="surface-card p-6 text-center text-muted-foreground">No items generated.</div>;
  }

  const norm = (s: string) => s.trim().toLowerCase();
  const score = data.reduce(
    (acc, q, i) => acc + (checked && norm(answers[i] || "") === norm(String(q.answer)) ? 1 : 0),
    0,
  );

  return (
    <Section
      title="Fill in the Blanks"
      right={
        checked ? (
          <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
            Score: {score} / {data.length}
          </span>
        ) : null
      }
    >
      <ol className="space-y-3">
        {data.map((q, i) => {
          const parts = String(q.sentence).split(/_{2,}/);
          const ans = answers[i] || "";
          const correct = checked && norm(ans) === norm(String(q.answer));
          return (
            <li key={i} className="rounded-lg border border-border p-4">
              <p className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="mr-1 text-muted-foreground">{i + 1}.</span>
                {parts.map((p, idx) => (
                  <span key={idx} className="contents">
                    <span>{p}</span>
                    {idx < parts.length - 1 && (
                      <input
                        type="text"
                        value={ans}
                        disabled={checked}
                        onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                        className={`mx-1 inline-block min-w-[8rem] rounded border px-2 py-0.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                          checked
                            ? correct
                              ? "border-success bg-success/10"
                              : "border-danger bg-danger/10"
                            : "border-input bg-card"
                        }`}
                        placeholder="answer"
                      />
                    )}
                  </span>
                ))}
              </p>
              {checked && (
                <div className="mt-2 space-y-1">
                  <p className={`text-sm font-semibold ${correct ? "text-success" : "text-danger"}`}>
                    {correct ? "✓ Correct" : `✗ Correct answer: ${String(q.answer)}`}
                  </p>
                  {q.explanation ? (
                    <p className="text-xs text-muted-foreground">{String(q.explanation)}</p>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="no-print mt-5">
        {!checked ? (
          <Button onClick={() => setChecked(true)}>
            <Check className="mr-2 h-4 w-4" /> Check answers
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              setChecked(false);
              setAnswers({});
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        )}
      </div>
    </Section>
  );
}

/* ---------- Flashcards (already interactive) ---------- */

function FlashcardsView({ data }: { data: AnyObj[] }) {
  return (
    <Section title="Flashcards">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((c, i) => (
          <Flashcard key={i} front={String(c.front)} back={String(c.back)} />
        ))}
      </div>
    </Section>
  );
}

function Flashcard({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((v) => !v)}
      className="group relative h-40 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition hover:border-primary hover:shadow-md"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {flipped ? "Definition" : "Term"}
      </p>
      <p className={`mt-2 ${flipped ? "text-sm" : "text-lg font-semibold"}`}>{flipped ? back : front}</p>
      <span className="absolute bottom-3 right-4 text-xs text-muted-foreground">
        {flipped ? "Tap to flip back" : "Tap to flip"}
      </span>
    </button>
  );
}

/* ---------- Socratic (answer hidden by default) ---------- */

function SocraticView({ data }: { data: AnyObj[] }) {
  return (
    <Section title="Socratic Questions">
      <ol className="space-y-4">
        {data.map((q, i) => (
          <SocraticItem
            key={i}
            index={i}
            question={String(q.question)}
            hint={q.hint ? String(q.hint) : ""}
            idealAnswer={q.idealAnswer ? String(q.idealAnswer) : ""}
          />
        ))}
      </ol>
    </Section>
  );
}

function SocraticItem({
  index,
  question,
  hint,
  idealAnswer,
}: {
  index: number;
  question: string;
  hint: string;
  idealAnswer: string;
}) {
  const [text, setText] = useState("");
  const [shown, setShown] = useState(false);
  return (
    <li className="rounded-lg border border-border p-4">
      <p className="font-medium">
        <span className="mr-2 text-muted-foreground">Q{index + 1}.</span>
        {question}
      </p>
      {hint ? (
        <p className="mt-2 rounded-md bg-accent/20 px-3 py-2 text-sm text-accent-foreground">
          <span className="font-semibold">💡 Hint:</span> {hint}
        </p>
      ) : null}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Type your answer here…"
        disabled={shown}
        className="no-print mt-3 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <div className="no-print mt-2 flex gap-2">
        {!shown ? (
          <Button size="sm" onClick={() => setShown(true)} disabled={!idealAnswer}>
            <Eye className="mr-2 h-4 w-4" /> Show answer
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShown(false);
              setText("");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        )}
      </div>
      {shown && idealAnswer && (
        <div className="mt-3 space-y-2">
          {text.trim() && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your answer
              </p>
              <p className="mt-1 whitespace-pre-line">{text}</p>
            </div>
          )}
          <div className="rounded-md bg-success/10 px-3 py-2 text-sm">
            <p className="font-semibold text-success">Ideal answer from the document:</p>
            <p className="mt-1 text-foreground">{idealAnswer}</p>
          </div>
        </div>
      )}
    </li>
  );
}

function ThinkAnswerItem({
  index,
  prompt,
  reveal,
  placeholder = "Type your thinking…",
}: {
  index: number;
  prompt: string;
  reveal: React.ReactNode;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  return (
    <li className="rounded-lg border border-border p-4">
      <p className="font-medium">
        <span className="mr-2 text-muted-foreground">Q{index + 1}.</span>
        {prompt}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="no-print mt-3 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {reveal && <RevealAnswer label="Show ideal answer">{reveal}</RevealAnswer>}
    </li>
  );
}

/* ---------- Debates ---------- */

function DebatesView({ data }: { data: AnyObj[] }) {
  return (
    <Section title="Debate Prompts">
      <ul className="space-y-5">
        {data.map((d, i) => (
          <DebateItem
            key={i}
            index={i}
            topic={String(d.topic)}
            context={d.context ? String(d.context) : ""}
            argsFor={asArr<string>(d.argumentsFor).map(String)}
            argsAgainst={asArr<string>(d.argumentsAgainst).map(String)}
            keyPoints={asArr<string>(d.keyPoints).map(String)}
            sampleArguments={d.sampleArguments ? String(d.sampleArguments) : ""}
          />
        ))}
      </ul>
    </Section>
  );
}

function DebateItem({
  index,
  topic,
  context,
  argsFor,
  argsAgainst,
  keyPoints,
  sampleArguments,
}: {
  index: number;
  topic: string;
  context: string;
  argsFor: string[];
  argsAgainst: string[];
  keyPoints: string[];
  sampleArguments: string;
}) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  return (
    <li className="rounded-lg border border-border p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Debate #{index + 1}
      </p>
      <p className="mt-1 text-lg font-bold">{topic}</p>
      {context && (
        <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Context:</span> {context}
        </p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-success/30 bg-success/5 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-success">Arguments FOR</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {argsFor.length === 0 ? (
              <li className="list-none text-muted-foreground">No arguments generated.</li>
            ) : (
              argsFor.map((a, j) => <li key={j}>{a}</li>)
            )}
          </ul>
        </div>
        <div className="rounded-md border border-danger/30 bg-danger/5 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-danger">Arguments AGAINST</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {argsAgainst.length === 0 ? (
              <li className="list-none text-muted-foreground">No arguments generated.</li>
            ) : (
              argsAgainst.map((a, j) => <li key={j}>{a}</li>)
            )}
          </ul>
        </div>
      </div>
      {keyPoints.length > 0 && (
        <div className="mt-3 rounded-md bg-accent/10 p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-accent-foreground">
            Key Points to Consider
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {keyPoints.map((k, j) => (
              <li key={j}>{k}</li>
            ))}
          </ul>
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Write your debate response or stance…"
        disabled={submitted}
        className="no-print mt-4 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <div className="no-print mt-2 flex gap-2">
        {!submitted ? (
          <Button size="sm" onClick={() => setSubmitted(true)} disabled={!sampleArguments}>
            <Eye className="mr-2 h-4 w-4" /> Show sample arguments
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSubmitted(false);
              setText("");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        )}
      </div>
      {submitted && sampleArguments && (
        <div className="mt-3 rounded-md bg-primary/10 px-3 py-2 text-sm">
          <p className="font-semibold text-primary">Sample Arguments:</p>
          <p className="mt-1 text-foreground">{sampleArguments}</p>
        </div>
      )}
    </li>
  );
}

/* ---------- Workshops ---------- */

function WorkshopsView({ data }: { data: AnyObj[] }) {
  return (
    <Section title="Workshops & Simulations">
      <div className="space-y-4">
        {data.map((w, i) => (
          <div key={i} className="rounded-lg border border-border p-5">
            <p className="text-lg font-bold">{String(w.title)}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Instructions
                </p>
                <p className="mt-1 whitespace-pre-line text-sm">{String(w.instructions)}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Student task
                  </p>
                  <p className="mt-1 text-sm">{String(w.task)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Expected outcome
                  </p>
                  <RevealAnswer label="Reveal expected outcome">
                    <p className="text-sm">{String(w.outcome)}</p>
                  </RevealAnswer>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------- Examples ---------- */

function ExamplesView({ data }: { data: AnyObj[] }) {
  return (
    <Section title="Real-World Examples">
      <div className="grid gap-3 lg:grid-cols-2">
        {data.map((e, i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <p className="font-semibold">{String(e.scenario)}</p>
            <RevealAnswer label="Show explanation & application">
              <p className="text-sm">{String(e.explanation)}</p>
              <p className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Where used:</span> {String(e.application)}
              </p>
            </RevealAnswer>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ---------- Reverse Questions ---------- */

function ReverseView({ data }: { data: AnyObj[] }) {
  return (
    <Section title="Reverse Questions">
      <ol className="space-y-3">
        {data.map((q, i) => (
          <ThinkAnswerItem
            key={i}
            index={i}
            prompt={String(q.question)}
            reveal={
              q.context ? (
                <p className="text-xs text-muted-foreground">{String(q.context)}</p>
              ) : null
            }
          />
        ))}
      </ol>
    </Section>
  );
}

/* ---------- Find the Mistake (interactive) ---------- */

function FindMistakesView({ data }: { data: AnyObj[] }) {
  return (
    <Section title="Find the Mistake">
      <ol className="space-y-3">
        {data.map((m, i) => (
          <FindMistakeItem
            key={i}
            index={i}
            wrong={String(m.wrongStatement)}
            hint={m.hint ? String(m.hint) : ""}
            correctStatement={m.correctStatement ? String(m.correctStatement) : ""}
            explanation={String(m.correctExplanation ?? "")}
          />
        ))}
      </ol>
    </Section>
  );
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function overlapScore(a: string, b: string): number {
  const at = new Set(tokenize(a));
  const bt = tokenize(b);
  if (bt.length === 0 || at.size === 0) return 0;
  const hits = bt.filter((w) => at.has(w)).length;
  return hits / Math.max(bt.length, 1);
}

function FindMistakeItem({
  index,
  wrong,
  hint,
  correctStatement,
  explanation,
}: {
  index: number;
  wrong: string;
  hint: string;
  correctStatement: string;
  explanation: string;
}) {
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);

  const target = correctStatement || explanation;
  const score = overlapScore(target, text);
  const isCorrect = checked && score >= 0.35;

  return (
    <li className="rounded-lg border border-border p-4">
      <p className="font-medium text-danger">
        <FileText className="mr-1 inline h-4 w-4" />
        <span className="mr-2 text-muted-foreground">#{index + 1}</span>
        {wrong}
      </p>
      {hint ? (
        <p className="mt-2 rounded-md bg-accent/20 px-3 py-2 text-sm text-accent-foreground">
          <span className="font-semibold">💡 Hint:</span> {hint}
        </p>
      ) : null}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Write the corrected statement…"
        disabled={checked}
        className="no-print mt-3 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <div className="no-print mt-2">
        {!checked ? (
          <Button size="sm" onClick={() => setChecked(true)} disabled={!text.trim()}>
            <Check className="mr-2 h-4 w-4" /> Submit correction
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setChecked(false);
              setText("");
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        )}
      </div>
      {checked && (
        <div className="mt-3 space-y-2">
          <div
            className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
              isCorrect ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            }`}
          >
            {isCorrect ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <X className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              {isCorrect
                ? "Your correction matches the key idea from the document."
                : "Not quite — your correction is missing the key ideas from the document."}
            </span>
          </div>
          {correctStatement && (
            <p className="rounded-md bg-success/10 px-3 py-2 text-sm">
              <span className="font-semibold text-success">Correct statement:</span> {correctStatement}
            </p>
          )}
          {explanation && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm">
              <span className="font-semibold">Why the original was wrong:</span> {explanation}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Match score: {Math.round(score * 100)}% keyword overlap with the document's correction.
          </p>
        </div>
      )}
    </li>
  );
}
