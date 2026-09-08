import { optionalEnv } from "@/lib/env";
import { fetchWithTimeout, ProviderError } from "@/lib/http";
import { providerError, providerLog } from "@/lib/logger";

export const LLM_PROVIDER = "Gemini";

const DEFAULT_MODEL = "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiPart = { text?: string };
type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
};

export function llmModel() {
  return optionalEnv("GEMINI_MODEL") ?? DEFAULT_MODEL;
}

export function isLlmConfigured() {
  return Boolean(optionalEnv("GEMINI_API_KEY"));
}

/**
 * Gemini accepts a subset of OpenAPI 3.0 schemas: object/array/string/integer/number/boolean,
 * `nullable`, `enum`, and `propertyOrdering`. It rejects `additionalProperties`, `$ref`, and
 * `oneOf`, so response schemas here are written by hand rather than derived from the Zod schemas.
 */
export type LlmJsonSchema = Record<string, unknown>;

export async function generateJsonWithLlm({
  system,
  prompt,
  schema,
  temperature = 0.6,
  maxOutputTokens = 8_192,
  timeoutMs = 45_000,
}: {
  system: string;
  prompt: string;
  schema: LlmJsonSchema;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}) {
  const apiKey = optionalEnv("GEMINI_API_KEY");
  if (!apiKey) throw new ProviderError(LLM_PROVIDER, "GEMINI_API_KEY is not configured", 503);

  const model = llmModel();
  const response = await fetchWithTimeout(
    `${ENDPOINT}/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature,
          maxOutputTokens,
        },
      }),
    },
    timeoutMs,
  );

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 500);
    throw new ProviderError(LLM_PROVIDER, `${model} request failed (${response.status})`, 502, detail);
  }

  const payload = (await response.json()) as GeminiResponse;
  const candidate = payload.candidates?.[0];
  const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? "").join("").trim();
  if (!text) {
    throw new ProviderError(LLM_PROVIDER, `${model} returned an empty response`, 502, {
      finishReason: candidate?.finishReason,
      blockReason: payload.promptFeedback?.blockReason,
    });
  }
  return text;
}

/**
 * Runs an LLM step that the caller can do without. Returns null instead of throwing so routes
 * can fall back to the local engine when the key is missing, the free-tier quota is spent, or
 * the model returns something the schema rejects.
 */
export async function tryLlm<T>(step: string, run: () => Promise<T>): Promise<T | null> {
  if (!isLlmConfigured()) return null;
  try {
    const result = await run();
    providerLog(LLM_PROVIDER, `${step} generated`, { model: llmModel() });
    return result;
  } catch (error) {
    providerError(LLM_PROVIDER, error);
    return null;
  }
}
