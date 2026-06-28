import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty?: "easy" | "medium" | "hard";
}

function makeShareCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ===== Generate MCQs for a quiz =====
const GenInput = z.object({
  documentText: z.string().min(1),
  topic: z.string().min(1),
  count: z.number().int().min(5).max(25),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
});

export const generateQuizQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const truncated = data.documentText.slice(0, 60000);

    const system = `You generate multiple-choice quiz questions for college students based STRICTLY on the provided lecture material. RULES:
- Use ONLY information from the provided document. No external knowledge.
- Every question must have exactly 4 options, one correct answer (verbatim one of the options), and an explanation (2-3 sentences from the document).
- Stay focused on the selected topic.
- Respond with VALID JSON ONLY. No markdown.`;

    const prompt = `TOPIC: ${data.topic}
COUNT: ${data.count}
DIFFICULTY: ${data.difficulty}

Return JSON: {"questions": [{"question": str, "options": [str,str,str,str], "correct_answer": str (must match one option exactly), "explanation": str, "difficulty": "easy"|"medium"|"hard"}]}

${data.difficulty === "mixed" ? "Distribute difficulty evenly across easy/medium/hard." : `All questions should be ${data.difficulty} difficulty.`}

LECTURE MATERIAL:
---
${truncated}
---`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt,
    });

    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: { questions?: QuizQuestion[] } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {}
      }
    }
    const questions = (parsed.questions || []).filter(
      (q) => q && q.question && Array.isArray(q.options) && q.options.length === 4 && q.correct_answer,
    );
    if (questions.length === 0) throw new Error("AI returned no valid questions");
    return { questions };
  });

// ===== Create / save quiz =====
const QuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correct_answer: z.string(),
  explanation: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

const CreateQuizInput = z.object({
  title: z.string().min(1).max(200),
  topic: z.string().min(1).max(500),
  questions: z.array(QuestionSchema).min(1),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).optional(),
  timeLimit: z.number().int().min(1).max(180).nullable().optional(),
  isPractice: z.boolean(),
  publish: z.boolean(),
  documentId: z.string().uuid().nullable().optional(),
});

export const createQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateQuizInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    const role = (prof?.role as "teacher" | "student") || "student";

    if (data.isPractice === false && role !== "teacher") {
      throw new Error("Only teachers can create class quizzes");
    }

    // Generate unique share code for published teacher quizzes
    let shareCode: string | null = null;
    if (data.publish && !data.isPractice) {
      for (let i = 0; i < 6; i++) {
        const code = makeShareCode();
        const { data: existing } = await supabase
          .from("quizzes")
          .select("id")
          .eq("share_code", code)
          .maybeSingle();
        if (!existing) {
          shareCode = code;
          break;
        }
      }
      if (!shareCode) throw new Error("Could not generate share code");
    }

    const { data: row, error } = await supabase
      .from("quizzes")
      .insert({
        creator_id: userId,
        creator_role: role,
        document_id: data.documentId ?? null,
        topic: data.topic,
        title: data.title,
        questions: data.questions as never,
        share_code: shareCode,
        time_limit: data.timeLimit ?? null,
        is_published: data.publish,
        is_practice: data.isPractice,
        difficulty: data.difficulty ?? null,
        question_count: data.questions.length,
      })
      .select("id, share_code")
      .single();

    if (error) throw new Error(error.message);
    return { id: row.id, shareCode: row.share_code };
  });

// ===== Fetch quiz by id =====
export const getQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: q, error } = await context.supabase
      .from("quizzes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!q) throw new Error("Quiz not found");
    return q;
  });

// ===== Fetch quiz by share code =====
export const getQuizByShareCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ code: z.string().min(4).max(8) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: q, error } = await context.supabase
      .from("quizzes")
      .select("*")
      .eq("share_code", data.code.toUpperCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!q) throw new Error("Quiz not found");
    return q;
  });

// ===== Start or resume attempt =====
export const startOrResumeAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ quizId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("quiz_attempts")
      .select("*")
      .eq("quiz_id", data.quizId)
      .eq("student_id", userId)
      .maybeSingle();
    if (existing) return existing;

    const { data: row, error } = await supabase
      .from("quiz_attempts")
      .insert({ quiz_id: data.quizId, student_id: userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ===== Auto-save attempt progress =====
const SaveProgressInput = z.object({
  attemptId: z.string().uuid(),
  answers: z.array(z.object({ question_index: z.number(), selected_option: z.string() })),
  currentQuestionIndex: z.number().int().min(0),
  suspiciousEvents: z.array(z.object({ event_type: z.string(), timestamp: z.string() })).optional(),
});

export const saveAttemptProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveProgressInput.parse(d))
  .handler(async ({ data, context }) => {
    const update: {
      answers: unknown;
      current_question_index: number;
      suspicious_events?: unknown;
    } = {
      answers: data.answers,
      current_question_index: data.currentQuestionIndex,
    };
    if (data.suspiciousEvents) update.suspicious_events = data.suspiciousEvents;
    const { error } = await context.supabase
      .from("quiz_attempts")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(update as any)
      .eq("id", data.attemptId)
      .eq("student_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Submit attempt =====
const SubmitInput = z.object({
  attemptId: z.string().uuid(),
  answers: z.array(z.object({ question_index: z.number(), selected_option: z.string() })),
  timeTaken: z.number().int().min(0),
  suspiciousEvents: z.array(z.object({ event_type: z.string(), timestamp: z.string() })).optional(),
});

export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubmitInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: attempt } = await supabase
      .from("quiz_attempts")
      .select("quiz_id, is_completed")
      .eq("id", data.attemptId)
      .eq("student_id", userId)
      .maybeSingle();
    if (!attempt) throw new Error("Attempt not found");
    if (attempt.is_completed) throw new Error("Attempt already submitted");

    const { data: quiz } = await supabase
      .from("quizzes")
      .select("questions")
      .eq("id", attempt.quiz_id)
      .maybeSingle();
    if (!quiz) throw new Error("Quiz not found");

    const questions = quiz.questions as unknown as QuizQuestion[];
    let score = 0;
    for (const a of data.answers) {
      const q = questions[a.question_index];
      if (q && a.selected_option === q.correct_answer) score++;
    }

    const update: Record<string, unknown> = {
      answers: data.answers,
      score,
      time_taken: data.timeTaken,
      is_completed: true,
      completed_at: new Date().toISOString(),
    };
    if (data.suspiciousEvents) update.suspicious_events = data.suspiciousEvents;

    const { error } = await supabase
      .from("quiz_attempts")
      .update(update)
      .eq("id", data.attemptId)
      .eq("student_id", userId);
    if (error) throw new Error(error.message);
    return { score, total: questions.length };
  });

// ===== Teacher: list my quizzes with stats =====
export const listMyQuizzesWithStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: quizzes, error } = await supabase
      .from("quizzes")
      .select("*")
      .eq("creator_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (quizzes || []).map((q) => q.id);
    const stats: Record<string, { attempts: number; avg: number | null; completed: number }> = {};
    if (ids.length > 0) {
      const { data: attempts } = await supabase
        .from("quiz_attempts")
        .select("quiz_id, score, is_completed")
        .in("quiz_id", ids);
      for (const id of ids) stats[id] = { attempts: 0, avg: null, completed: 0 };
      for (const a of attempts || []) {
        const s = stats[a.quiz_id];
        if (!s) continue;
        s.attempts++;
        if (a.is_completed && a.score != null) {
          s.completed++;
          s.avg = (s.avg ?? 0) + a.score;
        }
      }
      for (const id of ids) {
        const s = stats[id];
        if (s.completed > 0 && s.avg != null) s.avg = s.avg / s.completed;
      }
    }
    return { quizzes: quizzes || [], stats };
  });

// ===== Teacher: attempts for one quiz with student info =====
export const getQuizAttempts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ quizId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: quiz } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", data.quizId)
      .eq("creator_id", userId)
      .maybeSingle();
    if (!quiz) throw new Error("Quiz not found or not yours");

    const { data: attempts } = await supabase
      .from("quiz_attempts")
      .select("*")
      .eq("quiz_id", data.quizId)
      .order("completed_at", { ascending: false });

    const studentIds = Array.from(new Set((attempts || []).map((a) => a.student_id)));
    let students: Record<string, { display_name: string | null; email: string | null }> = {};
    if (studentIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", studentIds);
      for (const p of profs || []) students[p.id] = { display_name: p.display_name, email: p.email };
    }
    return { quiz, attempts: attempts || [], students };
  });

// ===== Teacher dashboard overview =====
export const getTeacherDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: quizzes } = await supabase
      .from("quizzes")
      .select("id, title, created_at, is_practice")
      .eq("creator_id", userId)
      .eq("is_practice", false);
    const quizIds = (quizzes || []).map((q) => q.id);
    let totalAttempts = 0;
    let avgScore: number | null = null;
    let totalStudents = 0;
    let recent: Array<{ student_id: string; quiz_id: string; score: number | null; completed_at: string | null }> = [];
    if (quizIds.length > 0) {
      const { data: attempts } = await supabase
        .from("quiz_attempts")
        .select("student_id, quiz_id, score, is_completed, completed_at")
        .in("quiz_id", quizIds)
        .order("completed_at", { ascending: false, nullsFirst: false });
      totalAttempts = (attempts || []).length;
      const completed = (attempts || []).filter((a) => a.is_completed && a.score != null);
      if (completed.length > 0) {
        // need question_count per quiz to compute %
        const qcMap: Record<string, number> = {};
        for (const q of quizzes || []) qcMap[q.id] = 0;
        const { data: qInfo } = await supabase
          .from("quizzes")
          .select("id, question_count")
          .in("id", quizIds);
        for (const qi of qInfo || []) qcMap[qi.id] = qi.question_count || 1;
        const pct = completed.map((a) => (a.score! / Math.max(1, qcMap[a.quiz_id] || 1)) * 100);
        avgScore = pct.reduce((s, n) => s + n, 0) / pct.length;
      }
      totalStudents = new Set((attempts || []).map((a) => a.student_id)).size;
      recent = (attempts || []).slice(0, 10).map((a) => ({
        student_id: a.student_id,
        quiz_id: a.quiz_id,
        score: a.score,
        completed_at: a.completed_at,
      }));
    }
    return {
      totalQuizzes: (quizzes || []).length,
      totalStudents,
      totalAttempts,
      avgScore,
      recent,
      quizMap: Object.fromEntries((quizzes || []).map((q) => [q.id, q.title])),
    };
  });

// ===== Student dashboard =====
export const getStudentDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: attempts } = await supabase
      .from("quiz_attempts")
      .select("*")
      .eq("student_id", userId)
      .order("created_at", { ascending: false });
    const quizIds = Array.from(new Set((attempts || []).map((a) => a.quiz_id)));
    let quizMap: Record<string, { title: string; question_count: number | null; is_practice: boolean }> = {};
    if (quizIds.length > 0) {
      const { data: qs } = await supabase
        .from("quizzes")
        .select("id, title, question_count, is_practice")
        .in("id", quizIds);
      for (const q of qs || []) quizMap[q.id] = { title: q.title, question_count: q.question_count, is_practice: q.is_practice };
    }

    // My own practice quizzes
    const { data: practice } = await supabase
      .from("quizzes")
      .select("*")
      .eq("creator_id", userId)
      .eq("is_practice", true)
      .order("created_at", { ascending: false });

    const completed = (attempts || []).filter((a) => a.is_completed && a.score != null);
    const trendRaw = completed
      .slice()
      .reverse()
      .map((a, idx) => {
        const qc = quizMap[a.quiz_id]?.question_count || 1;
        return { index: idx + 1, pct: Math.round((a.score! / qc) * 100), title: quizMap[a.quiz_id]?.title || "Quiz" };
      });
    const avgPct =
      trendRaw.length > 0 ? trendRaw.reduce((s, t) => s + t.pct, 0) / trendRaw.length : null;
    const pending = (attempts || []).filter((a) => !a.is_completed);
    return {
      attempts: attempts || [],
      quizMap,
      practiceQuizzes: practice || [],
      avgPct,
      trend: trendRaw,
      pendingCount: pending.length,
      totalAttempted: (attempts || []).length,
    };
  });

// ===== Log suspicious events (lightweight) =====
export const logSuspicious = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        attemptId: z.string().uuid(),
        events: z.array(z.object({ event_type: z.string(), timestamp: z.string() })),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("quiz_attempts")
      .update({ suspicious_events: data.events })
      .eq("id", data.attemptId)
      .eq("student_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
