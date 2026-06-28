import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Upload,
  Wand2,
  Sparkles,
  Trash2,
  Save,
  Copy,
  Check,
  Plus,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth-gate";
import { AppHeader } from "@/components/app-header";
import { useSession, useProfile } from "@/lib/use-profile";
import { Button } from "@/components/ui/button";
import { extractTextFromFile } from "@/lib/parse-document";
import { extractTopics } from "@/lib/activities.functions";
import { generateQuizQuestions, createQuiz, type QuizQuestion } from "@/lib/quiz.functions";

export const Route = createFileRoute("/quiz/new")({
  head: () => ({
    meta: [{ title: "Create Quiz — Lecture Lab AI" }],
  }),
  component: () => (
    <AuthGate>
      <QuizBuilder />
    </AuthGate>
  ),
});

function QuizBuilder() {
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
      <Builder role={profile.role} />
    </div>
  );
}

type Stage = "upload" | "configure" | "review" | "done";

function Builder({ role }: { role: "teacher" | "student" }) {
  const isTeacher = role === "teacher";
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [docText, setDocText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(isTeacher ? 10 : 10);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [timeLimit, setTimeLimit] = useState<number>(10);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [doneCode, setDoneCode] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const extractFn = useServerFn(extractTopics);
  const genFn = useServerFn(generateQuizQuestions);
  const createFn = useServerFn(createQuiz);
  const navigate = useNavigate();

  const handleFile = async (f: File) => {
    if (f.size > 50 * 1024 * 1024) {
      toast.error("File exceeds 50MB limit");
      return;
    }
    setFile(f);
    setParsing(true);
    try {
      const text = await extractTextFromFile(f);
      setDocText(text);
      const { topics } = await extractFn({ data: { documentText: text } });
      setTopics(topics);
      if (topics[0]) setTopic(topics[0]);
      setStage("configure");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to parse document");
    } finally {
      setParsing(false);
    }
  };

  const generate = async () => {
    if (!topic) return toast.error("Pick a topic");
    setGenerating(true);
    try {
      const min = isTeacher ? 10 : 5;
      const max = isTeacher ? 25 : 20;
      const c = Math.max(min, Math.min(max, count));
      const { questions } = await genFn({
        data: {
          documentText: docText,
          topic,
          count: c,
          difficulty,
        },
      });
      setQuestions(questions);
      if (!title) setTitle(`${topic} — ${isTeacher ? "Quiz" : "Practice"}`);
      setStage("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const saveQuiz = async (publish: boolean) => {
    if (!title.trim()) return toast.error("Add a title");
    if (questions.length === 0) return toast.error("No questions");
    setSaving(true);
    try {
      const { id, shareCode } = await createFn({
        data: {
          title: title.trim(),
          topic,
          questions,
          difficulty,
          timeLimit: isTeacher ? timeLimit : null,
          isPractice: !isTeacher,
          publish: isTeacher ? publish : true,
        },
      });
      if (!isTeacher) {
        navigate({ to: "/quiz/$code", params: { code: id } });
        return;
      }
      setDoneId(id);
      setDoneCode(shareCode);
      setStage("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
        <div className="text-xs text-slate-500">
          Step{" "}
          {stage === "upload" ? "1" : stage === "configure" ? "2" : stage === "review" ? "3" : "4"} of 4
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold">
          {isTeacher ? "Create Class Quiz" : "Create Practice Quiz"}
        </h1>
        <p className="text-slate-600 mt-1 text-sm">
          {isTeacher
            ? "Upload a document, generate MCQs, review, then publish to share with your students."
            : "Build a self-practice quiz from any document. Results stay private to you."}
        </p>
      </div>

      {stage === "upload" && (
        <FileDrop onFile={handleFile} parsing={parsing} file={file} />
      )}

      {stage === "configure" && (
        <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
          <div className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" /> Configure quiz
          </div>
          <div>
            <label className="text-sm font-medium">Topic</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            >
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">
                Number of questions ({isTeacher ? "10–25" : "5–20"})
              </label>
              <input
                type="number"
                min={isTeacher ? 10 : 5}
                max={isTeacher ? 25 : 20}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                className="mt-1 w-full border rounded-lg px-3 py-2 capitalize"
              >
                {(["easy", "medium", "hard", "mixed"] as const).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            {isTeacher && (
              <div>
                <label className="text-sm font-medium">Time limit (min)</label>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </div>
            )}
          </div>
          <Button
            onClick={generate}
            disabled={generating}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" /> Generate questions
              </>
            )}
          </Button>
        </div>
      )}

      {stage === "review" && (
        <div className="space-y-4">
          <div className="bg-white border rounded-2xl shadow-sm p-4">
            <label className="text-sm font-medium">Quiz title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <QuestionEditor
                key={i}
                index={i}
                question={q}
                onChange={(nq) => {
                  const cp = [...questions];
                  cp[i] = nq;
                  setQuestions(cp);
                }}
                onDelete={() => setQuestions(questions.filter((_, x) => x !== i))}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 justify-between">
            <Button variant="outline" onClick={() => setStage("configure")}>
              ← Back
            </Button>
            <div className="flex gap-2">
              {isTeacher && (
                <Button variant="outline" onClick={() => saveQuiz(false)} disabled={saving}>
                  Save draft
                </Button>
              )}
              <Button
                onClick={() => saveQuiz(true)}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isTeacher ? "Publish quiz" : "Start practice"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {stage === "done" && doneCode && doneId && (
        <div className="bg-white border rounded-2xl shadow-sm p-6 text-center space-y-4">
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-bold">Quiz published!</h2>
          <p className="text-sm text-slate-600">Share this code or link with your students:</p>
          <div className="inline-flex items-center gap-3 bg-slate-50 border rounded-xl px-4 py-3 font-mono text-2xl tracking-widest">
            {doneCode}
            <button
              onClick={() => {
                navigator.clipboard.writeText(doneCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="text-slate-500 hover:text-indigo-600"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <div className="text-xs text-slate-500 break-all">
            {typeof window !== "undefined" ? `${window.location.origin}/quiz/${doneCode}` : ""}
          </div>
          <div className="flex justify-center gap-2 pt-3">
            <Link to="/analytics/$quizId" params={{ quizId: doneId }}>
              <Button variant="outline">View analytics</Button>
            </Link>
            <Link to="/">
              <Button className="bg-indigo-600 hover:bg-indigo-700">Back to dashboard</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function FileDrop({
  onFile,
  parsing,
  file,
}: {
  onFile: (f: File) => void;
  parsing: boolean;
  file: File | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onClick={() => !parsing && inputRef.current?.click()}
      className="bg-white border-2 border-dashed border-indigo-200 rounded-2xl p-10 text-center cursor-pointer hover:border-indigo-400 transition"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.pptx,.docx,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {parsing ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
          <div className="mt-3 text-sm text-slate-600">
            Reading {file?.name}…
          </div>
        </>
      ) : (
        <>
          <Upload className="h-8 w-8 text-indigo-600 mx-auto" />
          <div className="mt-3 font-medium">Upload PDF, PPTX, DOCX or TXT</div>
          <div className="text-xs text-slate-500 mt-1">Up to 50 MB</div>
        </>
      )}
    </div>
  );
}

function QuestionEditor({
  index,
  question,
  onChange,
  onDelete,
}: {
  index: number;
  question: QuizQuestion;
  onChange: (q: QuizQuestion) => void;
  onDelete: () => void;
}) {
  const updateOption = (i: number, value: string) => {
    const opts = [...question.options];
    const old = opts[i];
    opts[i] = value;
    const correct = question.correct_answer === old ? value : question.correct_answer;
    onChange({ ...question, options: opts, correct_answer: correct });
  };
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs font-semibold text-slate-500">Question {index + 1}</div>
        <button onClick={onDelete} className="text-slate-400 hover:text-rose-600">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <textarea
        value={question.question}
        onChange={(e) => onChange({ ...question, question: e.target.value })}
        rows={2}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
      <div className="mt-3 space-y-2">
        {question.options.map((opt, i) => (
          <label
            key={i}
            className={`flex items-center gap-2 px-2 py-1 rounded ${
              question.correct_answer === opt ? "bg-emerald-50 border border-emerald-200" : ""
            }`}
          >
            <input
              type="radio"
              checked={question.correct_answer === opt}
              onChange={() => onChange({ ...question, correct_answer: opt })}
            />
            <input
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              className="flex-1 px-2 py-1 border rounded text-sm"
            />
          </label>
        ))}
      </div>
      <textarea
        value={question.explanation}
        onChange={(e) => onChange({ ...question, explanation: e.target.value })}
        rows={2}
        placeholder="Explanation"
        className="mt-3 w-full border rounded-lg px-3 py-2 text-xs text-slate-600"
      />
    </div>
  );
}
