import { NextResponse } from "next/server";
import { fetchCampaign } from "@/lib/brightdata";
import { DEMO_REQUIREMENTS, demoPause } from "@/lib/demo";
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
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim();
    if (!url) throw new ProviderError("Bright Data", "캠페인 URL을 입력해 주세요.", 400);

    if (isDemoMode()) {
      providerLog("BrightData", "Demo fixture loaded", { url });
      await demoPause(480);
      return NextResponse.json<CampaignAnalysisResult>({
        requirements: { ...DEMO_REQUIREMENTS, sourceUrl: url },
        source: {
          provider: "Bright Data",
          mode: "demo",
          fetchedAt: new Date().toISOString(),
          pageTitle: DEMO_REQUIREMENTS.campaignName,
          requestId: "demo-brd-campaign-01",
        },
      });
    }

    const page = await fetchCampaign(url);
    const extracted = await extractCampaignRequirements(page.content, page.url);
    return NextResponse.json<CampaignAnalysisResult>({
      requirements: extracted.requirements,
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
