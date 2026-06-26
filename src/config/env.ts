const DEFAULT_PORT = 8000;
const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";
const DEFAULT_GEMINI_TIMEOUT_MS = 20_000;

const toPositiveInteger = (
  value: string | undefined,
  fallback: number,
): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  port: toPositiveInteger(Bun.env.PORT, DEFAULT_PORT),
  geminiApiKey: Bun.env.GEMINI_API_KEY ?? Bun.env.GOOGLE_API_KEY,
  geminiModel: Bun.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
  geminiTimeoutMs: toPositiveInteger(
    Bun.env.GEMINI_TIMEOUT_MS,
    DEFAULT_GEMINI_TIMEOUT_MS,
  ),
};
