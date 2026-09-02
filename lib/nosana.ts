import { createHash } from "node:crypto";
import { optionalEnv } from "@/lib/env";
import { fetchWithTimeout, ProviderError } from "@/lib/http";
import { providerError, providerLog } from "@/lib/logger";
import { mediaAnalysisSchema } from "@/lib/schemas";
import { MAX_MEDIA_UPLOADS, type MediaAnalysis, type MediaAnalysisResult } from "@/types/media";

type NosanaRuntime = {
  provider?: string;
  device?: string;
  gpuName?: string;
  model?: string;
  jobId?: string;
  hostId?: string;
  latencyMs?: number;
};

type NosanaResponse = {
  fileName?: string;
  inputSha256?: string;
  category?: string;
  categoryConfidence?: number;
  qualityScore?: number;
  heroScore?: number;
  caption?: string;
  runtime?: NosanaRuntime;
  proofUrl?: string;
};

function baseUrl() {
  return optionalEnv("NOSANA_INFERENCE_URL")?.replace(/\/+$/, "");
}

function authHeaders() {
  const token = optionalEnv("NOSANA_INFERENCE_TOKEN");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export function isConfigured() {
  return Boolean(baseUrl());
}

function assertImage(file: File) {
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    throw new ProviderError("Nosana", `${file.name}: unsupported file format.`, 400);
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new ProviderError("Nosana", `${file.name}: the maximum size is 8 MB per photo.`, 400);
  }
}

async function analyzeOne(file: File): Promise<{ item: MediaAnalysis; runtime: NosanaRuntime }> {
  const endpoint = baseUrl();
  if (!endpoint) throw new ProviderError("Nosana", "NOSANA_INFERENCE_URL is not configured", 503);
  assertImage(file);

  const bytes = Buffer.from(await file.arrayBuffer());
  const expectedHash = createHash("sha256").update(bytes).digest("hex");
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: file.type }), file.name);

  const response = await fetchWithTimeout(
    `${endpoint}/v1/classify`,
    {
      method: "POST",
      headers: authHeaders(),
      body: form,
    },
    60_000,
  );
  const payload = (await response.json().catch(() => ({}))) as NosanaResponse & { detail?: string };
  if (!response.ok) {
    throw new ProviderError("Nosana", payload.detail || `GPU inference returned HTTP ${response.status}`);
  }

  if (payload.runtime?.device !== "cuda" || !payload.runtime.jobId) {
    throw new ProviderError(
      "Nosana",
      "Inference response is missing CUDA and Nosana job proof; CPU or unverified output is rejected.",
    );
  }
  if (payload.inputSha256 && payload.inputSha256 !== expectedHash) {
    throw new ProviderError("Nosana", "Inference input hash does not match the uploaded image.");
  }

  const normalized = mediaAnalysisSchema.parse({
    fileName: payload.fileName || file.name,
    category: payload.category || "other",
    qualityScore: payload.qualityScore ?? 0,
    relevanceScore: payload.categoryConfidence ?? 0,
    caption: payload.caption,
  });
  return { item: normalized, runtime: payload.runtime };
}

export async function analyzeMedia(files: File[]): Promise<MediaAnalysisResult> {
  if (!files.length) throw new ProviderError("Nosana", "Upload at least one photo for analysis.", 400);
  if (files.length > MAX_MEDIA_UPLOADS) throw new ProviderError("Nosana", `A maximum of ${MAX_MEDIA_UPLOADS} photos can be analyzed at once.`, 400);
  providerLog("Nosana", "Running GPU inference...", { images: files.length });

  try {
    const outputs: Awaited<ReturnType<typeof analyzeOne>>[] = [];
    // Two concurrent requests keep a small GPU deployment responsive without exhausting VRAM.
    for (let index = 0; index < files.length; index += 2) {
      outputs.push(...(await Promise.all(files.slice(index, index + 2).map(analyzeOne))));
    }
    const runtime = outputs[0]?.runtime;
    providerLog("Nosana", "Complete", {
      workloadId: runtime?.jobId,
      gpu: runtime?.gpuName,
      images: outputs.length,
    });
    return {
      items: outputs.map((output) => output.item),
      source: {
        provider: "Nosana",
        mode: "real",
        workloadId: runtime?.jobId,
        model: runtime?.model,
        analyzedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    providerError("Nosana", error);
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("Nosana", error instanceof Error ? error.message : String(error));
  }
}

export async function healthCheck(probe = false) {
  const endpoint = baseUrl();
  if (!endpoint) return { ok: false, detail: "NOSANA_INFERENCE_URL missing" };
  if (!probe) return { ok: true, detail: "GPU inference endpoint configured" };

  const response = await fetchWithTimeout(
    `${endpoint}/health`,
    { headers: authHeaders() },
    8_000,
  );
  const payload = (await response.json().catch(() => ({}))) as {
    ready?: boolean;
    device?: string;
    modelLoaded?: boolean;
    gpuName?: string;
  };
  const ok = response.ok && payload.ready === true && payload.device === "cuda" && payload.modelLoaded === true;
  return { ok, detail: ok ? `CUDA ready${payload.gpuName ? ` · ${payload.gpuName}` : ""}` : "GPU workload is not ready" };
}
