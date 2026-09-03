import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  makeQuizCode,
  normalizeQuizQuestions,
  scoreAnswers,
  stripAnswers,
  type StoredQuestions,
} from "./quiz.server";

const CreateSchema = z.object({
  topic: z.string().min(1).max(500),
  activityType: z.enum(["mcqs", "fillBlanks"]),
  generatedJson: z.unknown(),
});

export const createQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const questions = normalizeQuizQuestions(data.activityType, data.generatedJson);
    if (questions.items.length === 0) {
      throw new Error("This activity has no scorable questions.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    for (let attempt = 0; attempt < 6; attempt++) {
      const code = makeQuizCode();
      const { error } = await supabaseAdmin.from("quizzes").insert({
        code,
        teacher_id: context.userId,
        topic: data.topic,
        activity_type: data.activityType,
        questions: questions as never,
      });
      if (!error) return { code, total: questions.items.length };
      if (!/duplicate key/i.test(error.message)) throw new Error(error.message);
    }
    throw new Error("Could not allocate a quiz code. Please try again.");
  });

const CodeSchema = z.object({ code: z.string().min(4).max(12) });

export const getQuizForStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CodeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const code = data.code.trim().toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: quiz } = await supabaseAdmin
      .from("quizzes")
      .select("code, topic, activity_type, questions")
      .eq("code", code)
      .maybeSingle();
    if (!quiz) throw new Error("No quiz found for that code.");

    const { data: existing } = await supabaseAdmin
      .from("quiz_attempts")
      .select("score, total, tab_switches, submitted_at")
      .eq("quiz_code", code)
      .eq("student_id", context.userId)
      .maybeSingle();

    return {
      code: quiz.code,
      topic: quiz.topic,
      activityType: quiz.activity_type,
      // Answers and explanations are stripped here and never reach the browser.
      questions: stripAnswers(quiz.questions as unknown as StoredQuestions),
      attempt: existing ?? null,
    };
  });

const SubmitSchema = z.object({
  code: z.string().min(4).max(12),
  answers: z.array(z.string().max(2000)).max(200),
  tabSwitches: z.number().int().min(0).max(100000).default(0),
});

export const submitQuizAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubmitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const code = data.code.trim().toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: quiz } = await supabaseAdmin
      .from("quizzes")
      .select("questions")
      .eq("code", code)
      .maybeSingle();
    if (!quiz) throw new Error("No quiz found for that code.");

    const stored = quiz.questions as unknown as StoredQuestions;
    const { score, total, details } = scoreAnswers(stored, data.answers);

    const { error } = await supabaseAdmin.from("quiz_attempts").insert({
      quiz_code: code,
      student_id: context.userId,
      answers: data.answers as never,
      score,
      total,
      tab_switches: data.tabSwitches,
    });
    if (error) {
      if (/duplicate key/i.test(error.message)) {
        throw new Error("You have already submitted this quiz.");
      }
      throw new Error(error.message);
    }

    return { score, total, details };
  });

export const getQuizResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CodeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const code = data.code.trim().toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: quiz } = await supabaseAdmin
      .from("quizzes")
      .select("code, topic, activity_type, teacher_id, created_at")
      .eq("code", code)
      .maybeSingle();
    if (!quiz) throw new Error("No quiz found for that code.");
    if (quiz.teacher_id !== context.userId) {
      throw new Error("You can only view results for your own quizzes.");
    }

    const { data: attempts } = await supabaseAdmin
      .from("quiz_attempts")
      .select("student_id, score, total, tab_switches, submitted_at")
      .eq("quiz_code", code)
      .order("score", { ascending: false });

    const ids = (attempts ?? []).map((a) => a.student_id);
    const { data: people } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };

    const byId = new Map((people ?? []).map((p) => [p.id, p]));

    return {
      quiz: {
        code: quiz.code,
        topic: quiz.topic,
        activityType: quiz.activity_type,
        createdAt: quiz.created_at,
      },
      attempts: (attempts ?? []).map((a) => ({
        studentName: byId.get(a.student_id)?.full_name || "—",
        email: byId.get(a.student_id)?.email || "—",
        score: a.score,
        total: a.total,
        tabSwitches: a.tab_switches,
        submittedAt: a.submitted_at,
      })),
    };
  });

export const listMyQuizzes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("quizzes")
      .select("code, topic, activity_type, created_at")
      .eq("teacher_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { quizzes: data ?? [] };
  });
