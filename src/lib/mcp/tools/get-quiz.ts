import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "get_quiz",
  title: "Get a quiz",
  description:
    "Get one quiz with its full question list, by quiz id or by share code. Only quizzes the signed-in user can access are returned.",
  inputSchema: {
    quizId: z.string().optional().describe("The quiz UUID."),
    shareCode: z.string().optional().describe("The quiz share code, e.g. ABC123."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ quizId, shareCode }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    if (!quizId && !shareCode) return errorResult("Provide either quizId or shareCode.");
    let query = supabaseForUser(ctx).from("quizzes").select("*");
    query = quizId ? query.eq("id", quizId) : query.eq("share_code", shareCode!.toUpperCase());
    const { data, error } = await query.maybeSingle();
    if (error) return errorResult(error.message);
    if (!data) return errorResult("Quiz not found or not accessible.");
    return textResult(data);
  },
});
