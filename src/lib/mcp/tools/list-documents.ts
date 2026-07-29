import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_documents",
  title: "List uploaded lecture materials",
  description:
    "List the lecture materials the signed-in user uploaded to Lecture Lab AI, including the topics extracted from each document.",
  inputSchema: {
    limit: z.number().int().optional().describe("Maximum documents to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    const { data, error } = await supabaseForUser(ctx)
      .from("documents")
      .select("id, file_name, file_type, extracted_topics, uploaded_at")
      .eq("user_id", ctx.getUserId()!)
      .order("uploaded_at", { ascending: false })
      .limit(take);
    if (error) return errorResult(error.message);
    return textResult({ documents: data ?? [] });
  },
});
