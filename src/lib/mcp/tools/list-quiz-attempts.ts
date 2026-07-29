import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_quiz_attempts",
  title: "List quiz attempts",
  description:
    "List student attempts for a quiz: score, time taken, completion state and number of suspicious tab-switch events. Teachers see attempts on their own quizzes; students see their own attempts.",
  inputSchema: {
    quizId: z.string().describe("The quiz UUID to list attempts for."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ quizId }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select(
        "id, quiz_id, student_id, score, time_taken, is_completed, started_at, completed_at, suspicious_events",
      )
      .eq("quiz_id", quizId)
      .order("started_at", { ascending: false });
    if (error) return errorResult(error.message);

    const attempts = (data ?? []).map((a) => ({
      ...a,
      suspicious_event_count: Array.isArray(a.suspicious_events) ? a.suspicious_events.length : 0,
      suspicious_events: undefined,
    }));

    const scored = attempts.filter((a) => typeof a.score === "number");
    const average =
      scored.length > 0
        ? scored.reduce((sum, a) => sum + (a.score as number), 0) / scored.length
        : null;

    return textResult({ quizId, count: attempts.length, averageScore: average, attempts });
  },
});
