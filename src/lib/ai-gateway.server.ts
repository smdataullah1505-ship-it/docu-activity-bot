import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

export const DEFAULT_MODEL = "google/gemini-3-flash-preview";
/** Models tried in order when calling the Google Gemini API directly with a user-supplied key. */
export const DIRECT_GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string; status?: string };
};

/**
 * Calls the user's own Google Gemini API directly (BYOK path).
 * Maps the OpenAI-style system/prompt shape into Gemini's contents/parts format
 * and maps the response back to plain text.
 * The API key is used for this single call only — never logged or stored.
 */
async function callDirectGemini(userApiKey: string, system: string, prompt: string) {
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${DIRECT_GEMINI_MODEL}:generateContent?key=${encodeURIComponent(userApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        }),
      },
    );
  } catch {
    throw new Error("Could not reach Google Gemini with your API key. Check your connection and try again.");
  }

  const body = (await res.json().catch(() => ({}))) as GeminiResponse;

  if (!res.ok) {
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new Error("Your Gemini API key was rejected. Please check the key in Settings.");
    }
    if (res.status === 429) {
      throw new Error("Your Gemini API key hit its rate limit. Please wait a moment and try again.");
    }
    throw new Error(body.error?.message || "Google Gemini request failed. Please try again.");
  }

  const text = (body.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Google Gemini returned an empty response. Please try again.");
  return { text };
}

/**
 * Single entry point for text generation.
 * When `userApiKey` is provided the request goes straight to Google Gemini with
 * that key (the user pays). Otherwise the existing Lovable AI Gateway path is used,
 * completely unchanged.
 */
export async function callAiGateway(opts: {
  lovableApiKey: string;
  system: string;
  prompt: string;
  model?: string;
  userApiKey?: string;
}): Promise<{ text: string }> {
  if (opts.userApiKey) {
    return callDirectGemini(opts.userApiKey, opts.system, opts.prompt);
  }
  const gateway = createLovableAiGatewayProvider(opts.lovableApiKey);
  const { text } = await generateText({
    model: gateway(opts.model ?? DEFAULT_MODEL),
    system: opts.system,
    prompt: opts.prompt,
  });
  return { text };
}
