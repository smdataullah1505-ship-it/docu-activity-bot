import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_saved_activities",
  title: "List saved activities",
  description:
    "List classroom activities the signed-in user generated in Lecture Lab AI (MCQs, flashcards, debates, etc.), newest first. Optionally filter by topic or activity type.",
  inputSchema: {
    topic: z.string().optional().describe("Filter by topic (case-insensitive partial match)."),
    activityType: z
      .string()
      .optional()
      .describe("Filter by activity mode, e.g. mcqs, flashcards, debates, socraticQuestions."),
    includeContent: z
      .boolean()
      .optional()
      .describe("When true, include the full generated activity JSON (can be large)."),
    limit: z.number().int().optional().describe("Maximum rows to return (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ topic, activityType, includeContent, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const take = Math.min(Math.max(limit ?? 10, 1), 50);
    const columns = includeContent
      ? "id, topic, activity_type, document_name, difficulty, question_count, created_at, generated_json"
      : "id, topic, activity_type, document_name, difficulty, question_count, created_at";
    let query = supabaseForUser(ctx)
      .from("saved_activities")
      .select(columns)
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(take);
    if (topic) query = query.ilike("topic", `%${topic}%`);
    if (activityType) query = query.eq("activity_type", activityType);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return textResult({ activities: data ?? [] });
  },
});
