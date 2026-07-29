import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "get_profile",
  title: "Get my profile",
  description:
    "Get the signed-in user's Lecture Lab AI profile: display name, email and role (teacher or student).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const { data, error } = await supabaseForUser(ctx)
      .from("profiles")
      .select("id, display_name, email, role, created_at")
      .eq("id", ctx.getUserId()!)
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!data) return errorResult("No profile found for this user.");
    return textResult(data);
  },
});
