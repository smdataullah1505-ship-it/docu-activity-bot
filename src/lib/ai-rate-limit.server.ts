import { getRequest } from "@tanstack/react-start/server";

/** Max characters accepted for uploaded document text. */
export const MAX_DOCUMENT_CHARS = 200_000;
/** Max characters accepted for short free-text fields (topic, concept, mode). */
export const MAX_SHORT_TEXT = 500;

const HOURLY_LIMIT = 60;
const IMAGE_HOURLY_LIMIT = 20;

function clientKey(): string {
  try {
    const req = getRequest();
    const h = req?.headers;
    const ip =
      h?.get("cf-connecting-ip") ||
      h?.get("x-real-ip") ||
      h?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    return ip.slice(0, 100);
  } catch {
    return "unknown";
  }
}

/**
 * Server-side per-visitor throttle for paid AI generation endpoints.
 * Throws a 429 Response when the caller exceeds the hourly quota.
 */
export async function enforceAiQuota(kind: "text" | "image" = "text") {
  const limit = kind === "image" ? IMAGE_HOURLY_LIMIT : HOURLY_LIMIT;
  const key = `${kind}:${clientKey()}`;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("bump_ai_rate_limit" as never, {
      _client_key: key,
      _limit: limit,
    } as never);
    if (error) {
      console.error("[ai-quota] check failed");
      return;
    }
    if (data === false) {
      throw new Response("Too many requests. Please try again later.", { status: 429 });
    }
  } catch (e) {
    if (e instanceof Response) throw e;
    console.error("[ai-quota] unavailable");
  }
}
