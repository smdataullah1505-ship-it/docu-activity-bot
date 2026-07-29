import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_quizzes",
  title: "List my quizzes",
  description:
    "List quizzes created by the signed-in user, newest first. Returns id, title, topic, share code, question count, difficulty, time limit and whether it is a practice quiz.",
  inputSchema: {
    practiceOnly: z
      .boolean()
      .optional()
      .describe("When true, return only self-practice quizzes."),
    limit: z.number().int().optional().describe("Maximum number of quizzes to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ practiceOnly, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    let query = supabaseForUser(ctx)
      .from("quizzes")
      .select(
        "id, title, topic, share_code, question_count, difficulty, time_limit, is_practice, is_published, created_at",
      )
      .eq("creator_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(take);
    if (practiceOnly) query = query.eq("is_practice", true);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return textResult({ quizzes: data ?? [] });
  },
});
