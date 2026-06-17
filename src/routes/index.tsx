import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
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
} from "lucide-react";
import { extractTopics, generateActivity } from "@/lib/activities.functions";
import { extractTextFromFile } from "@/lib/parse-document";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lecture Lab AI — Classroom Activity Generator" },
      {
        name: "description",
        content:
          "Upload PDF, DOCX, PPTX, or TXT lecture material. Generate quizzes, flashcards, debates, simulations, and more — grounded in your own content.",
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

function LectureLab() {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [documentText, setDocumentText] = useState<string>("");
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<ActivityKey | null>(null);

  const [mcqDifficulty, setMcqDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [mcqCount, setMcqCount] = useState<5 | 10 | 20>(10);
  const [reverseConcept, setReverseConcept] = useState<string>("");

  const [parsing, setParsing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const extractTopicsFn = useServerFn(extractTopics);
  const generateActivityFn = useServerFn(generateActivity);

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
  };

  const runGeneration = async (mode: ActivityKey) => {
    if (!selectedTopic) return;
    if (mode === "reverseQuestions" && !reverseConcept.trim()) {
      toast.error("Enter a concept for reverse questioning first.");
      return;
    }
    try {
      setSelectedMode(mode);
      setGenerating(true);
      setResult(null);
      setStep("results");
      const options: Record<string, unknown> = {};
      if (mode === "mcqs") {
        options.difficulty = mcqDifficulty;
        options.count = mcqCount;
      }
      if (mode === "reverseQuestions") {
        options.concept = reverseConcept.trim();
      }
      const { json } = await generateActivityFn({
        data: { documentText, topic: selectedTopic, mode, options },
      });
      const parsed = JSON.parse(json);
      setResult(parsed);
      setGenerating(false);
    } catch (err) {
      setGenerating(false);
      const msg = err instanceof Error ? err.message : "Generation failed.";
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
            reverseConcept={reverseConcept}
            setReverseConcept={setReverseConcept}
            onRun={runGeneration}
            onBack={() => setStep("topics")}
          />
        )}

        {step === "results" && (
          <ResultsStep
            topic={selectedTopic}
            mode={selectedMode}
            generating={generating}
            result={result}
            onBack={() => setStep("activity")}
            onRegenerate={() => selectedMode && runGeneration(selectedMode)}
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
  return (
    <ol className="no-print mb-8 flex items-center gap-2 overflow-x-auto py-2">
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
  reverseConcept,
  setReverseConcept,
  onRun,
  onBack,
}: {
  topic: string;
  mcqDifficulty: "easy" | "medium" | "hard" | "mixed";
  setMcqDifficulty: (v: "easy" | "medium" | "hard" | "mixed") => void;
  mcqCount: 5 | 10 | 20;
  setMcqCount: (v: 5 | 10 | 20) => void;
  reverseConcept: string;
  setReverseConcept: (v: string) => void;
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

          <div className="mt-5">
            <p className="text-sm font-medium">Reverse questioning concept</p>
            <input
              type="text"
              value={reverseConcept}
              onChange={(e) => setReverseConcept(e.target.value)}
              placeholder="e.g. polymorphism"
              className="mt-2 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Required only for the "Reverse Questioning" activity.
            </p>
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
  result,
  onBack,
  onRegenerate,
}: {
  topic: string;
  mode: ActivityKey | null;
  generating: boolean;
  result: Record<string, unknown> | null;
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

      {generating && (
        <div className="surface-card flex items-center gap-4 p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <div>
            <p className="font-medium">Generating activity from your material…</p>
            <p className="text-sm text-muted-foreground">This usually takes a few seconds.</p>
          </div>
        </div>
      )}

      {!generating && result && mode && <ResultRenderer mode={mode} data={result} topic={topic} />}
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card mb-5 p-6">
      <h3 className="mb-4 text-lg font-bold">{title}</h3>
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
              <p className="mt-1 text-sm text-muted-foreground">{c.explanation}</p>
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
              <p className="mt-1 text-sm text-success">
                <span className="font-semibold">Answer:</span> {q.answer}
              </p>
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

function difficultyColor(d: "easy" | "medium" | "hard"): string {
  if (d === "easy") return "bg-[oklch(0.92_0.1_145)] text-[oklch(0.3_0.12_145)]";
  if (d === "medium") return "bg-[oklch(0.92_0.12_70)] text-[oklch(0.35_0.15_55)]";
  return "bg-[oklch(0.92_0.1_25)] text-[oklch(0.4_0.18_25)]";
}

type MCQ = { question: string; options: string[]; correct: string; explanation: string };

function MCQView({ data }: { data: AnyObj }) {
  const buckets: { key: "easy" | "medium" | "hard"; label: string; list: MCQ[] }[] = [
    { key: "easy", label: "Easy", list: asArr<MCQ>(data.easy) },
    { key: "medium", label: "Medium", list: asArr<MCQ>(data.medium) },
    { key: "hard", label: "Hard", list: asArr<MCQ>(data.hard) },
  ];
  return (
    <>
      {buckets.map(
        (b) =>
          b.list.length > 0 && (
            <Section key={b.key} title={`${b.label} (${b.list.length})`}>
              <ol className="space-y-4">
                {b.list.map((q, i) => (
                  <li key={i} className="rounded-lg border border-border p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${difficultyColor(b.key)}`}
                      >
                        {b.label}
                      </span>
                      <span className="text-xs text-muted-foreground">Q{i + 1}</span>
                    </div>
                    <p className="font-medium">{q.question}</p>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {q.options?.map((opt, j) => {
                        const isCorrect = opt === q.correct;
                        return (
                          <li
                            key={j}
                            className={`rounded-md border px-3 py-2 text-sm ${
                              isCorrect
                                ? "border-success bg-success/10 font-medium"
                                : "border-border"
                            }`}
                          >
                            <span className="mr-2 text-muted-foreground">
                              {String.fromCharCode(65 + j)}.
                            </span>
                            {opt}
                            {isCorrect && <Check className="ml-2 inline h-4 w-4 text-success" />}
                          </li>
                        );
                      })}
                    </ul>
                    {q.explanation && (
                      <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Why:</span> {q.explanation}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </Section>
          ),
      )}
    </>
  );
}

function FillBlanksView({ data }: { data: AnyObj[] }) {
  return (
    <Section title="Fill in the Blanks">
      <ol className="space-y-3">
        {data.map((q, i) => (
          <li key={i} className="rounded-lg border border-border p-4">
            <p>
              <span className="mr-2 text-muted-foreground">{i + 1}.</span>
              {String(q.sentence)}
            </p>
            <p className="mt-2 text-sm">
              <span className="font-semibold text-success">Answer:</span> {String(q.answer)}
            </p>
            {q.explanation ? (
              <p className="mt-1 text-xs text-muted-foreground">{String(q.explanation)}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}

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

function SocraticView({ data }: { data: AnyObj[] }) {
  return (
    <Section title="Socratic Questions">
      <ol className="space-y-3">
        {data.map((q, i) => (
          <li key={i} className="rounded-lg border border-border p-4">
            <p className="font-medium">
              <span className="mr-2 text-muted-foreground">Q{i + 1}.</span>
              {String(q.question)}
            </p>
            {q.hint ? (
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Hint:</span> {String(q.hint)}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}

function DebatesView({ data }: { data: AnyObj[] }) {
  return (
    <Section title="Debate Prompts">
      <ul className="space-y-3">
        {data.map((d, i) => (
          <li key={i} className="rounded-lg border border-border p-4">
            <p className="font-semibold">{String(d.topic)}</p>
            {d.context ? (
              <p className="mt-1 text-sm text-muted-foreground">{String(d.context)}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

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
                  <p className="mt-1 text-sm">{String(w.outcome)}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ExamplesView({ data }: { data: AnyObj[] }) {
  return (
    <Section title="Real-World Examples">
      <div className="grid gap-3 lg:grid-cols-2">
        {data.map((e, i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <p className="font-semibold">{String(e.scenario)}</p>
            <p className="mt-2 text-sm">{String(e.explanation)}</p>
            <p className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Where used:</span> {String(e.application)}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ReverseView({ data }: { data: AnyObj[] }) {
  return (
    <Section title="Reverse Questions">
      <ol className="space-y-3">
        {data.map((q, i) => (
          <li key={i} className="rounded-lg border border-border p-4">
            <p className="font-medium">
              <span className="mr-2 text-muted-foreground">Q{i + 1}.</span>
              {String(q.question)}
            </p>
            {q.context ? (
              <p className="mt-1 text-xs text-muted-foreground">{String(q.context)}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}

function FindMistakesView({ data }: { data: AnyObj[] }) {
  return (
    <Section title="Find the Mistake">
      <ol className="space-y-3">
        {data.map((m, i) => (
          <li key={i} className="rounded-lg border border-border p-4">
            <p className="font-medium text-danger">
              <FileText className="mr-1 inline h-4 w-4" />
              {String(m.wrongStatement)}
            </p>
            {m.hint ? (
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Hint:</span> {String(m.hint)}
              </p>
            ) : null}
            <p className="mt-2 rounded-md bg-success/10 px-3 py-2 text-sm">
              <span className="font-semibold text-success">Correct:</span> {String(m.correctExplanation)}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
