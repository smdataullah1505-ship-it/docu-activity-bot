import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const HashSchema = z.object({
  documentHash: z.string().min(1).max(64),
});

const SaveSchema = HashSchema.extend({
  topics: z.array(z.string().min(1).max(500)).max(100),
});

export const getCachedTopics = createServerFn({ method: "POST" })
  .inputValidator((data) => HashSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("cached_topics")
      .select("topics, updated_at")
      .eq("document_hash", data.documentHash)
      .limit(1);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return { topics: null as string[] | null };
    const parsed = z.array(z.string()).safeParse(rows[0].topics);
    if (!parsed.success || parsed.data.length === 0) return { topics: null as string[] | null };
    return { topics: parsed.data, updatedAt: rows[0].updated_at };
  });

export const saveCachedTopics = createServerFn({ method: "POST" })
  .inputValidator((data) => SaveSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cached_topics")
      .upsert(
        {
          document_hash: data.documentHash,
          topics: data.topics as never,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_hash" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearCachedTopics = createServerFn({ method: "POST" })
  .inputValidator((data) => HashSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("cached_topics")
      .delete()
      .eq("document_hash", data.documentHash);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
