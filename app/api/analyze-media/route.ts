import { NextResponse } from "next/server";
import { demoMediaAnalysis, demoPause } from "@/lib/demo";
import { isDemoMode } from "@/lib/env";
import { apiError, ProviderError } from "@/lib/http";
import { providerLog } from "@/lib/logger";
import { analyzeMedia } from "@/lib/nosana";
import { assertRateLimit } from "@/lib/rate-limit";
import type { MediaAnalysisResult } from "@/types/media";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    if (!isDemoMode()) assertRateLimit(request, "media", { limit: 6 });
    const form = await request.formData();
    const language = form.get("language") === "ko" ? "ko" : "en";
    const files = form.getAll("files").filter((value): value is File => value instanceof File);
    if (!files.length) throw new ProviderError("Nosana", "Upload at least one photo.", 400);
    if (files.length > 12) throw new ProviderError("Nosana", "A maximum of 12 photos can be analyzed at once.", 400);

    if (isDemoMode()) {
      providerLog("Nosana", "Demo GPU fixture loaded", { images: files.length });
      await demoPause(620);
      return NextResponse.json<MediaAnalysisResult>({
        items: demoMediaAnalysis(files.map((file) => file.name), language),
        source: {
          provider: "Nosana",
          mode: "demo",
          workloadId: "demo-nosana-gpu-job",
          model: "openai/clip-vit-base-patch32",
          analyzedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json(await analyzeMedia(files));
  } catch (error) {
    return apiError(error);
  }
}
