import { NextResponse } from "next/server";
import { demoMediaAnalysis, demoPause } from "@/lib/demo";
import { isDemoMode } from "@/lib/env";
import { apiError, ProviderError } from "@/lib/http";
import { analyzeMediaLocally } from "@/lib/local-engine";
import { providerLog } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import { MAX_MEDIA_UPLOADS, type MediaAnalysisResult } from "@/types/media";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    if (!isDemoMode()) assertRateLimit(request, "media", { limit: 6 });
    const form = await request.formData();
    const language = form.get("language") === "ko" ? "ko" : "en";
    const files = form.getAll("files").filter((value): value is File => value instanceof File);
    if (!files.length) throw new ProviderError("Media Reader", "Upload at least one photo.", 400);
    if (files.length > MAX_MEDIA_UPLOADS) throw new ProviderError("Media Reader", `A maximum of ${MAX_MEDIA_UPLOADS} photos can be analyzed at once.`, 400);

    if (isDemoMode()) {
      providerLog("LocalEngine", "Demo media fixture loaded", { images: files.length });
      await demoPause(620);
      return NextResponse.json<MediaAnalysisResult>({
        items: demoMediaAnalysis(files.map((file) => file.name), language),
        source: {
          provider: "Local Engine",
          mode: "demo",
          model: "file-order-v1",
          analyzedAt: new Date().toISOString(),
        },
      });
    }

    const invalidFile = files.find((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024);
    if (invalidFile) {
      throw new ProviderError("Media Reader", `${invalidFile.name}: use a JPG, PNG, or WEBP file up to 8 MB.`, 400);
    }

    return NextResponse.json<MediaAnalysisResult>({
      items: analyzeMediaLocally(files.map((file) => file.name), language),
      source: {
        provider: "Local Engine",
        mode: "local",
        model: "file-order-v1",
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
