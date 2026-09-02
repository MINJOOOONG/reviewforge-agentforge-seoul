import { NextResponse } from "next/server";
import { fetchCampaign } from "@/lib/brightdata";
import { DEMO_REQUIREMENTS, DEMO_REQUIREMENTS_KO, demoPause } from "@/lib/demo";
import { isDemoMode } from "@/lib/env";
import { apiError, ProviderError } from "@/lib/http";
import { providerLog } from "@/lib/logger";
import { extractCampaignRequirements } from "@/lib/qwen";
import { assertRateLimit } from "@/lib/rate-limit";
import type { CampaignAnalysisResult } from "@/types/campaign";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    if (!isDemoMode()) assertRateLimit(request, "campaign", { limit: 6 });
    const body = (await request.json()) as { url?: string; language?: unknown };
    const url = body.url?.trim();
    if (!url) throw new ProviderError("Bright Data", "Enter a campaign URL.", 400);

    if (isDemoMode()) {
      const demoRequirements = body.language === "ko" ? DEMO_REQUIREMENTS_KO : DEMO_REQUIREMENTS;
      providerLog("BrightData", "Demo fixture loaded");
      await demoPause(480);
      return NextResponse.json<CampaignAnalysisResult>({
        requirements: { ...demoRequirements, sourceUrl: url },
        source: {
          provider: "Bright Data",
          mode: "demo",
          fetchedAt: new Date().toISOString(),
          pageTitle: demoRequirements.campaignName,
          requestId: "demo-brd-campaign-01",
        },
      });
    }

    const page = await fetchCampaign(url);
    const extracted = await extractCampaignRequirements(page.content, page.url, {
      language: body.language === "ko" ? "ko" : "en",
    });
    return NextResponse.json<CampaignAnalysisResult>({
      requirements: extracted.requirements,
      campaignEvidence: extracted.evidence,
      source: {
        provider: "Bright Data",
        mode: "real",
        fetchedAt: new Date().toISOString(),
        pageTitle: page.pageTitle,
        requestId: page.requestId || extracted.requestId,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
