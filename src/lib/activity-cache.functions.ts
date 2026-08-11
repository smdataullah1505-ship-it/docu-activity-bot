import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LookupSchema = z.object({
  documentHash: z.string().min(1).max(64),
  topic: z.string().min(1).max(500),
  activityType: z.string().min(1).max(100),
  difficulty: z.string().max(50).nullable().optional(),
  questionCount: z.number().int().min(0).max(100).nullable().optional(),
});

const SaveSchema = LookupSchema.extend({
  documentName: z.string().max(500).default(""),
  generatedJson: z.unknown(),
  replace: z.boolean().optional().default(false),
});

export const getCachedActivity = createServerFn({ method: "POST" })
  .inputValidator((data) => LookupSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const difficulty = data.difficulty ?? null;
    const questionCount = data.questionCount ?? null;
    let q = supabaseAdmin
      .from("saved_activities")
      .select("generated_json, created_at")
      .eq("topic", data.topic)
      .eq("activity_type", data.activityType)
      .order("created_at", { ascending: false })
      .limit(1);
    q = difficulty ? q.eq("difficulty", difficulty) : q.is("difficulty", null);
    q = questionCount
      ? q.eq("question_count", questionCount)
      : q.is("question_count", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return { hit: false as const };
    return {
      hit: true as const,
      generatedJson: rows[0].generated_json,
      createdAt: rows[0].created_at,
    };
  });

export const saveCachedActivity = createServerFn({ method: "POST" })
  .inputValidator((data) => SaveSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const difficulty = data.difficulty ?? null;
    const questionCount = data.questionCount ?? null;

    if (data.replace) {
      let del = supabaseAdmin
        .from("saved_activities")
        .delete()
        .eq("topic", data.topic)
        .eq("activity_type", data.activityType);
      del = difficulty ? del.eq("difficulty", difficulty) : del.is("difficulty", null);
      del = questionCount
        ? del.eq("question_count", questionCount)
        : del.is("question_count", null);
      await del;
    }

    const { error } = await supabaseAdmin.from("saved_activities").insert({
      document_name: data.documentName,
      topic: data.topic,
      activity_type: data.activityType,
      difficulty,
      question_count: questionCount,
      generated_json: data.generatedJson as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true, createdAt: new Date().toISOString() };
  });
