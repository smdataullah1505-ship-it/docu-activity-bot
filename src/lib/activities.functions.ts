import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const ExtractInput = z.object({
  documentText: z.string().min(1),
});

export const extractTopics = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ExtractInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const truncated = data.documentText.slice(0, 60000);

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system:
        "You extract topics/sections from lecture material. Respond ONLY with a JSON array of topic strings. No markdown, no prose. 5-15 topics. Each topic should be a short, specific subject covered in the material (3-8 words).",
      prompt: `Extract the main topics covered in this lecture material. Return JSON array only.\n\n---\n${truncated}`,
    });

    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let topics: string[] = [];
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) topics = parsed.filter((t) => typeof t === "string");
    } catch {
      topics = cleaned
        .split("\n")
        .map((l) => l.replace(/^[-*\d.\s]+/, "").trim())
        .filter(Boolean);
    }
    return { topics };
  });

const ActivityInput = z.object({
  documentText: z.string().min(1),
  topic: z.string().min(1),
  mode: z.string().min(1),
  options: z
    .object({
      difficulty: z.enum(["easy", "medium", "hard", "mixed"]).optional(),
      count: z.number().int().positive().optional(),
      concept: z.string().optional(),
    })
    .optional(),
});

const MODE_INSTRUCTIONS: Record<string, string> = {
  quickRecap: `Generate a "quickRecap" object with: keyPoints (3-5 strings), importantConcepts (array of {concept, explanation}), oralQuestions (5 items of {question, answer}), memoryTriggers (array of strings - mnemonics).`,
  mcqs: `Generate an "mcqs" object with keys easy, medium, hard each containing an array of {question, options (4 strings), correct (the correct option string), explanation}. Distribute the requested count across difficulties (or use the requested single difficulty only - leave others as empty arrays). Easy = basic recall, Medium = application/understanding, Hard = analysis/evaluation. No repetition across difficulties.`,
  fillBlanks: `Generate "fillBlanks" array of 5-8 items {sentence (use ___ for blank), answer, explanation}, based on important terminology.`,
  flashcards: `Generate "flashcards" array of 5-10 items {front (term), back (simple explanation)}.`,
  socraticQuestions: `Generate "socraticQuestions" array of 5-7 thinking questions {question, hint}. Focus on why/how/reasoning/comparison, NOT direct recall.`,
  debates: `Generate "debates" array of 5 items {topic, context}. Encourage opinions and technical reasoning.`,
  workshops: `Generate "workshops" array of 2-3 items {title, instructions (step-by-step string), task, outcome}. Must be possible inside a classroom in 10-15 min.`,
  examples: `Generate "examples" array of 3-5 items {scenario, explanation, application} connecting the topic with real applications.`,
  reverseQuestions: `Given the provided concept, generate "reverseQuestions" array of 5-8 items {question, context} - questions students might ask about the concept.`,
  findMistakes: `Generate "findMistakes" array of 3-5 items {wrongStatement (intentionally incorrect statement based on the document), hint, correctExplanation}.`,
};

export const generateActivity = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ActivityInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const instr = MODE_INSTRUCTIONS[data.mode];
    if (!instr) throw new Error("Unknown mode");

    const truncated = data.documentText.slice(0, 60000);
    const opts = data.options || {};
    const optionsLine = [
      opts.difficulty ? `Difficulty: ${opts.difficulty}` : null,
      opts.count ? `Total questions: ${opts.count}` : null,
      opts.concept ? `Student-facing concept: ${opts.concept}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const system = `You generate classroom activities for college/engineering students based STRICTLY on provided lecture material. RULES:
- Use ONLY information from the provided document. No external knowledge.
- Stay focused on the selected topic.
- If the document lacks info for the topic, return an empty structure for that activity key.
- Activities must be teacher-friendly, 10-15 min classroom-suitable.
- Respond with VALID JSON ONLY. No markdown fences, no commentary.`;

    const prompt = `SELECTED TOPIC: ${data.topic}
ACTIVITY MODE: ${data.mode}
${optionsLine}

INSTRUCTIONS FOR THIS MODE:
${instr}

Return a JSON object containing ONLY the key for this mode (e.g. {"${data.mode}": ...}).

LECTURE MATERIAL:
---
${truncated}
---`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt,
    });

    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          /* ignore */
        }
      }
    }
    if (!parsed) throw new Error("AI returned invalid JSON");
    return parsed as Record<string, unknown>;
  });
