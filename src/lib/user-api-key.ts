/**
 * Bring-your-own-key storage for the user's Google Gemini API key.
 * The key lives ONLY in this browser's localStorage — it is never persisted
 * server-side and must never be logged.
 */
const GEMINI_KEY_STORAGE = "lecturelab_gemini_key";

export function getGeminiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(GEMINI_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function setGeminiKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = key.trim();
    if (!trimmed) {
      window.localStorage.removeItem(GEMINI_KEY_STORAGE);
      return;
    }
    window.localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function clearGeminiKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GEMINI_KEY_STORAGE);
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function hasGeminiKey(): boolean {
  return getGeminiKey().length > 0;
}

/** Returns the key or undefined, suitable for spreading into server-fn payloads. */
export function geminiKeyOrUndefined(): string | undefined {
  const k = getGeminiKey();
  return k ? k : undefined;
}
