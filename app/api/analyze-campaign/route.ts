import { NextResponse } from "next/server";
import { readCampaignPage } from "@/lib/web-reader";
import { DEMO_REQUIREMENTS, DEMO_REQUIREMENTS_KO, demoPause } from "@/lib/demo";
import { isDemoMode } from "@/lib/env";
import { apiError, ProviderError } from "@/lib/http";
import { extractCampaignRequirementsLocally } from "@/lib/local-engine";
import { providerLog } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import type { CampaignAnalysisResult } from "@/types/campaign";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    if (!isDemoMode()) assertRateLimit(request, "campaign", { limit: 6 });
    const body = (await request.json()) as { url?: string; language?: unknown };
    const url = body.url?.trim();
    if (!url) throw new ProviderError("Web Reader", "Enter a campaign URL.", 400);

    if (isDemoMode()) {
      const demoRequirements = body.language === "ko" ? DEMO_REQUIREMENTS_KO : DEMO_REQUIREMENTS;
      providerLog("LocalEngine", "Demo campaign fixture loaded");
      await demoPause(480);
      return NextResponse.json<CampaignAnalysisResult>({
        requirements: { ...demoRequirements, sourceUrl: url },
        source: {
          provider: "Demo Fixture",
          mode: "demo",
          fetchedAt: new Date().toISOString(),
          pageTitle: demoRequirements.campaignName,
          requestId: "demo-brd-campaign-01",
        },
      });
    }

    const page = await readCampaignPage(url);
    const language = body.language === "ko" ? "ko" : "en";
    const extracted = extractCampaignRequirementsLocally(page.content, page.url, language);
    return NextResponse.json<CampaignAnalysisResult>({
      requirements: extracted.requirements,
      campaignEvidence: extracted.evidence,
      source: {
        provider: page.provider,
        mode: "real",
        fetchedAt: new Date().toISOString(),
        pageTitle: page.pageTitle,
        requestId: page.requestId,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
