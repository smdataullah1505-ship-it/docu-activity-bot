import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAiGateway } from "./ai-gateway.server";
import { enforceAiQuota, MAX_DOCUMENT_CHARS, MAX_SHORT_TEXT } from "./ai-rate-limit.server";

const BaseInput = z.object({
  documentText: z.string().min(1).max(MAX_DOCUMENT_CHARS),
  topic: z.string().min(1).max(MAX_SHORT_TEXT),
  userApiKey: z.string().max(200).optional(),
});

function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* ignore */
      }
    }
  }
  throw new Error("AI returned invalid JSON");
}

const COMMON_SYSTEM = `You generate classroom learning content for college/engineering students based STRICTLY on the provided lecture material. RULES:
- Use ONLY information from the document. No external knowledge.
- If the document lacks information for the requested activity, respond with the empty-shape JSON described.
- Respond with VALID JSON ONLY. No markdown fences, no commentary.`;

/* ============================================================
 *  1) IMAGE QUESTION
 * ============================================================ */

export const generateImageQuestion = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => BaseInput.parse(d))
  .handler(async ({ data }) => {
    if (!data.userApiKey) await enforceAiQuota("image");
    const key = process.env.LOVABLE_API_KEY;
    if (!key && !data.userApiKey) throw new Error("Missing LOVABLE_API_KEY");

    const truncated = data.documentText.slice(0, 50000);

    // Step 1: generate an educational image prompt + 3-5 grounded questions
    const { text } = await callAiGateway({
      lovableApiKey: key ?? "",
      userApiKey: data.userApiKey,
      system: COMMON_SYSTEM,
      prompt: `SELECTED TOPIC: ${data.topic}

Produce a JSON object with this exact shape:
{
  "imagePrompt": "A clear, educational diagram illustrating <specific concept from document> showing <key visible elements grounded in document>. Style: clean, labeled, suitable for students. Colors: professional, high contrast for clarity.",
  "imageDescription": "Plain-text description of what the generated image will show (2-3 sentences). Used as fallback if image generation fails.",
  "questions": [
    {
      "question": "...",
      "answer": "Short canonical correct answer (1-6 words)",
      "explanation": "2-3 sentences. Reference both the diagram AND the specific information from the document.",
      "documentReference": "Short quote or section reference from the document, or empty string"
    }
  ]
}

REQUIREMENTS:
- Generate 3-5 questions about what the image depicts, grounded in the document.
- The image prompt MUST be derived from the document's content for the selected topic, not external knowledge.
- If the document does not describe anything visualizable for this topic, return {"imagePrompt": "", "imageDescription": "", "questions": []}.

LECTURE MATERIAL:
---
${truncated}
---`,
    });

    const parsed = parseJson(text) as {
      imagePrompt?: string;
      imageDescription?: string;
      questions?: unknown[];
    };

    if (!parsed.imagePrompt || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return {
        json: JSON.stringify({
          empty: true,
          message:
            "The selected topic does not contain enough visualizable information for an image question. Please pick another topic.",
        }),
      };
    }

    // Step 2: call the AI gateway image endpoint (non-streaming) to get b64 PNG.
    // Direct Gemini (BYOK) path does not support the gateway image endpoint —
    // fall back to the text/description-based question instead of failing.
    let imageDataUrl = "";
    try {
      if (data.userApiKey || !key) throw new Error("skip-image");
      const imgRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image",
          messages: [{ role: "user", content: parsed.imagePrompt }],
          modalities: ["image", "text"],
        }),
      });
      if (imgRes.ok) {
        const body = (await imgRes.json()) as { data?: { b64_json?: string }[] };
        const b64 = body.data?.[0]?.b64_json;
        if (b64) imageDataUrl = `data:image/png;base64,${b64}`;
      }
    } catch {
      /* image generation is best-effort; fall back to description-only */
    }

    return {
      json: JSON.stringify({
        empty: false,
        imagePrompt: parsed.imagePrompt,
        imageDescription: parsed.imageDescription || "",
        image: imageDataUrl,
        questions: parsed.questions,
      }),
    };
  });

/* ============================================================
 *  2) CHART INTERPRETER
 * ============================================================ */

export const generateChartActivity = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => BaseInput.parse(d))
  .handler(async ({ data }) => {
    if (!data.userApiKey) await enforceAiQuota("text");
    const key = process.env.LOVABLE_API_KEY;
    if (!key && !data.userApiKey) throw new Error("Missing LOVABLE_API_KEY");

    const truncated = data.documentText.slice(0, 60000);

    const { text } = await callAiGateway({
      lovableApiKey: key ?? "",
      userApiKey: data.userApiKey,
      system: COMMON_SYSTEM,
      prompt: `SELECTED TOPIC: ${data.topic}

Scan the lecture material for numerical data, comparisons, trends, percentages, year-over-year values, or category breakdowns related to the selected topic.

If the document contains data, produce a JSON object with this exact shape:
{
  "empty": false,
  "chartType": "bar" | "line" | "pie",
  "title": "Short chart title",
  "xLabel": "Axis label",
  "yLabel": "Axis label",
  "data": [ { "name": "label", "value": number } ],
  "sourceQuote": "Short quote or section reference from the document",
  "questions": [
    {
      "question": "...",
      "answer": "Short correct answer",
      "explanation": "2-3 sentences referencing both the chart AND the document."
    }
  ]
}

RULES:
- Choose chartType "line" for time-series trends, "bar" for category comparisons, "pie" for proportions/parts-of-a-whole.
- Provide 3-8 data points, all numeric values, all derived from the document.
- Generate exactly 3 questions: Q1 basic reading, Q2 trend analysis, Q3 inference/calculation.
- If no numerical data exists for this topic in the document, return {"empty": true, "message": "No chart data available for this topic in the document."}.

LECTURE MATERIAL:
---
${truncated}
---`,
    });

    const parsed = parseJson(text);
    return { json: JSON.stringify(parsed) };
  });

/* ============================================================
 *  3) BEFORE / AFTER VISUALIZATION
 * ============================================================ */

export const generateBeforeAfter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => BaseInput.parse(d))
  .handler(async ({ data }) => {
    if (!data.userApiKey) await enforceAiQuota("text");
    const key = process.env.LOVABLE_API_KEY;
    if (!key && !data.userApiKey) throw new Error("Missing LOVABLE_API_KEY");

    const truncated = data.documentText.slice(0, 60000);

    const { text } = await callAiGateway({
      lovableApiKey: key ?? "",
      userApiKey: data.userApiKey,
      system: COMMON_SYSTEM,
      prompt: `SELECTED TOPIC: ${data.topic}

Identify a single causal relationship in the document for the selected topic (X causes Y, as X increases Y decreases, higher X leads to higher Y, etc.).

If a causal relationship exists, produce a JSON object with this exact shape:
{
  "empty": false,
  "title": "Short title for the relationship (e.g. 'Price vs. Demand')",
  "causeName": "Name of input parameter (e.g. 'Price')",
  "causeUnit": "Unit string or empty string (e.g. '$')",
  "effectName": "Name of dependent variable (e.g. 'Demand')",
  "effectUnit": "Unit string or empty string (e.g. 'units')",
  "min": number,
  "max": number,
  "step": number,
  "default": number,
  "relationship": "Plain-English description of the relationship from the document",
  "documentReference": "Short quote or section reference",
  "points": [
    { "cause": number, "effect": number, "note": "Brief contextual note from the document for this range or empty string" }
  ],
  "insight": "1-2 sentence additional insight from the document about why the relationship behaves this way."
}

RULES:
- Generate 6-10 points spanning min..max evenly, with effect values derived from the document's described relationship.
- Notes should reference the document.
- If the document has no causal relationship for this topic, return {"empty": true, "message": "No causal relationship found for this topic in the document."}.

LECTURE MATERIAL:
---
${truncated}
---`,
    });

    const parsed = parseJson(text);
    return { json: JSON.stringify(parsed) };
  });
