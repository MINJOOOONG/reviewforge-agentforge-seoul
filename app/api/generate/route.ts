import { NextResponse } from "next/server";
import { demoGeneration, demoPause } from "@/lib/demo";
import { isDemoMode } from "@/lib/env";
import { apiError, ProviderError } from "@/lib/http";
import { analyzeMediaLocally, generateReviewLocally } from "@/lib/local-engine";
import { providerLog } from "@/lib/logger";
import { campaignRequirementsSchema, mediaAnalysisSchema } from "@/lib/schemas";
import { assertRateLimit } from "@/lib/rate-limit";
import type { GenerationResult } from "@/types/generation";
import type { Locale } from "@/types/locale";
import { MAX_MEDIA_UPLOADS } from "@/types/media";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    if (!isDemoMode()) assertRateLimit(request, "generate", { limit: 5 });
    const form = await request.formData();
    const requirementsRaw = form.get("requirements");
    const mediaRaw = form.get("media");
    const campaignEvidence = String(form.get("campaignEvidence") || "").trim();
    const personalNote = String(form.get("personalNote") || "").trim();
    const language: Locale = form.get("language") === "ko" ? "ko" : "en";
    const files = form.getAll("files").filter((value): value is File => value instanceof File);
    if (typeof requirementsRaw !== "string" || typeof mediaRaw !== "string") {
      throw new ProviderError("Review Writer", "Campaign or media evidence is missing", 400);
    }
    if (personalNote.length > 4_000) {
      throw new ProviderError("Review Writer", "Personal Note must be 4,000 characters or fewer.", 400);
    }
    if (campaignEvidence.length > 32_000) {
      throw new ProviderError("Review Writer", "Campaign evidence is too large.", 400);
    }
    if (files.length > MAX_MEDIA_UPLOADS) {
      throw new ProviderError("Review Writer", `A maximum of ${MAX_MEDIA_UPLOADS} photos can be used at once.`, 400);
    }

    const requirements = campaignRequirementsSchema.parse(JSON.parse(requirementsRaw));
    const media = mediaAnalysisSchema.array().parse(JSON.parse(mediaRaw));
    if (isDemoMode()) {
      providerLog("LocalEngine", "Demo grounded draft loaded", { images: files.length });
      await demoPause(720);
      const generated = demoGeneration(requirements, media, personalNote, language);
      return NextResponse.json<GenerationResult>({
        ...generated,
        source: {
          provider: "Local Engine",
          mode: "demo",
          model: "evidence-template-v1",
          generatedAt: new Date().toISOString(),
          requestId: "demo-generation-01",
        },
      });
    }

    let uploadBytes = 0;
    for (const file of files) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new ProviderError("Review Writer", `${file.name}: unsupported image format.`, 400);
      }
      uploadBytes += file.size;
      if (file.size > 8 * 1024 * 1024 || uploadBytes > 28 * 1024 * 1024) {
        throw new ProviderError("Review Writer", "Images must be 8 MB or less each and 28 MB or less in total.", 413);
      }
    }

    const effectiveMedia = media.length
      ? media
      : analyzeMediaLocally(files.map((file) => file.name), language);
    const generated = generateReviewLocally(requirements, effectiveMedia, personalNote, language);
    return NextResponse.json<GenerationResult>({
      ...generated,
      source: {
        provider: "Local Engine",
        mode: "local",
        model: "evidence-template-v1",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
