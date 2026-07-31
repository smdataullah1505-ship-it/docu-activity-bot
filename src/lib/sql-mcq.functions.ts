import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateSqlBatch } from "./sql-mcq.server";
import { enforceAiQuota, MAX_SHORT_TEXT } from "./ai-rate-limit.server";

const SqlInput = z.object({
  topic: z.string().min(1).max(MAX_SHORT_TEXT),
  count: z.union([z.literal(5), z.literal(10), z.literal(20)]),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
});

export const generateSqlMcqs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SqlInput.parse(d))
  .handler(async ({ data }) => {
    await enforceAiQuota("text");
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    if (data.difficulty === "mixed") {
      const base = Math.ceil(data.count / 3);
      const easyN = base;
      const mediumN = base;
      const hardN = Math.max(data.count - easyN - mediumN, 0);
      const [easy, medium, hard] = await Promise.all([
        generateSqlBatch(key, data.topic, "easy", easyN),
        generateSqlBatch(key, data.topic, "medium", mediumN),
        generateSqlBatch(key, data.topic, "hard", hardN),
      ]);
      return { json: JSON.stringify({ sqlMcqs: { easy, medium, hard } }) };
    }

    const batch = await generateSqlBatch(key, data.topic, data.difficulty, data.count);
    return {
      json: JSON.stringify({
        sqlMcqs: {
          easy: data.difficulty === "easy" ? batch : [],
          medium: data.difficulty === "medium" ? batch : [],
          hard: data.difficulty === "hard" ? batch : [],
        },
      }),
    };
  });
