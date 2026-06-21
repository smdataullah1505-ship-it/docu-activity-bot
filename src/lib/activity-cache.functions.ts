import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SaveSchema = z.object({
  documentName: z.string().max(500).default(""),
  topic: z.string().min(1).max(500),
  activityType: z.string().min(1).max(100),
  difficulty: z.string().max(50).nullable().optional(),
  questionCount: z.number().int().min(0).max(100).nullable().optional(),
  generatedJson: z.unknown(),
  replace: z.boolean().optional().default(false),
});

export const saveCachedActivity = createServerFn({ method: "POST" })
  .inputValidator((data) => SaveSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const difficulty = data.difficulty ?? null;
    const questionCount = data.questionCount ?? null;

    if (data.replace) {
      let del = supabaseAdmin
        .from("generated_activities")
        .delete()
        .eq("topic", data.topic)
        .eq("activity_type", data.activityType);
      del = difficulty ? del.eq("difficulty", difficulty) : del.is("difficulty", null);
      del = questionCount
        ? del.eq("question_count", questionCount)
        : del.is("question_count", null);
      await del;
    }

    const { error } = await supabaseAdmin.from("generated_activities").insert({
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
