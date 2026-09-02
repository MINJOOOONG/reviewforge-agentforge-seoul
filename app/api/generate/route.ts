import { NextResponse } from "next/server";
import { demoGeneration, demoPause } from "@/lib/demo";
import { isDemoMode } from "@/lib/env";
import { apiError, ProviderError } from "@/lib/http";
import { providerLog } from "@/lib/logger";
import { generateReview } from "@/lib/qwen";
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
      throw new ProviderError("Qwen Cloud", "Campaign or media evidence is missing", 400);
    }
    if (personalNote.length > 4_000) {
      throw new ProviderError("Qwen Cloud", "Personal Note must be 4,000 characters or fewer.", 400);
    }
    if (campaignEvidence.length > 32_000) {
      throw new ProviderError("Qwen Cloud", "Campaign evidence is too large.", 400);
    }
    if (files.length > MAX_MEDIA_UPLOADS) {
      throw new ProviderError("Qwen Cloud", `A maximum of ${MAX_MEDIA_UPLOADS} photos can be used at once.`, 400);
    }

    const requirements = campaignRequirementsSchema.parse(JSON.parse(requirementsRaw));
    const media = mediaAnalysisSchema.array().parse(JSON.parse(mediaRaw));
    if (isDemoMode()) {
      providerLog("Qwen", "Demo grounded draft loaded", { images: files.length });
      await demoPause(720);
      const generated = demoGeneration(requirements, media, personalNote, language);
      return NextResponse.json<GenerationResult>({
        ...generated,
        source: {
          provider: "Qwen Cloud",
          mode: "demo",
          model: "qwen3.5-flash",
          generatedAt: new Date().toISOString(),
          requestId: "demo-qwen-generation-01",
        },
      });
    }

    if (!campaignEvidence) {
      throw new ProviderError("Qwen Cloud", "Verified campaign page evidence is missing.", 400);
    }

    let totalBytes = 0;
    const images = await Promise.all(
      files.slice(0, MAX_MEDIA_UPLOADS).map(async (file) => {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          throw new ProviderError("Qwen Cloud", `${file.name}: unsupported image format.`, 400);
        }
        totalBytes += file.size;
        if (file.size > 8 * 1024 * 1024 || totalBytes > 28 * 1024 * 1024) {
          throw new ProviderError("Qwen Cloud", "Images must be 8 MB or less each and 28 MB or less in total.", 413);
        }
        const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
        return { fileName: file.name, mimeType: file.type, dataUrl: `data:${file.type};base64,${base64}` };
      }),
    );
    const generated = await generateReview({ requirements, campaignEvidence, media, personalNote, images, language });
    return NextResponse.json<GenerationResult>({
      title: generated.title,
      applicationMessage: generated.applicationMessage,
      blogDraft: generated.blogDraft,
      photoOrder: generated.photoOrder,
      unverifiedClaims: generated.unverifiedClaims,
      source: {
        provider: "Qwen Cloud",
        mode: "real",
        model: generated.model,
        generatedAt: new Date().toISOString(),
        requestId: generated.requestId,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
