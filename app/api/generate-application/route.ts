import { NextResponse } from "next/server";
import { fetchNaverBusinessResearch } from "@/lib/brightdata";
import { demoPause } from "@/lib/demo";
import { isDemoMode } from "@/lib/env";
import { apiError, ProviderError } from "@/lib/http";
import { providerLog } from "@/lib/logger";
import { generateApplicationMessages } from "@/lib/qwen";
import { assertRateLimit } from "@/lib/rate-limit";
import { campaignRequirementsSchema } from "@/lib/schemas";
import type { ApplicationGenerationResult, ApplicationMessageVariant } from "@/types/application";
import type { CampaignRequirements } from "@/types/campaign";
import type { Locale } from "@/types/locale";

export const runtime = "nodejs";
export const maxDuration = 120;

function demoApplicationVariants(requirements: CampaignRequirements, applicantKeywords: string[], language: Locale): ApplicationMessageVariant[] {
  const highlight = language === "ko"
    ? "제철 식재료를 활용한 시그니처 런치와 차분한 공간"
    : "its seasonal signature lunch and calm dining concept";
  if (language === "ko") {
    const brand = requirements.brand || "해당 업체";
    const profile = applicantKeywords.length ? `저는 ${applicantKeywords.join(", ")}이라는 강점이 있습니다. ` : "";
    return [
      { label: "맞춤 신청 문구", message: `${profile}네이버 공개 정보에서 확인한 ${highlight}이 특히 궁금해 ${brand} 캠페인에 신청합니다. 선정된다면 직접 촬영한 사진과 저만의 관점을 담고, 공고의 키워드와 리뷰 미션을 꼼꼼히 반영해 그 매력이 잘 전달되는 후기를 작성하겠습니다.` },
    ];
  }
  const campaignName = requirements.campaignName || "this campaign";
  const mission = requirements.otherRequirements[0] || requirements.requiredMentions[0];
  const personalProfile = applicantKeywords.length > 0
    ? `My background includes ${applicantKeywords.join(", ")}. `
    : "";

  return [
    {
      label: "Recommended message",
      message: `${personalProfile}I was especially interested in ${highlight}, based on public Naver information, and would love to apply for ${campaignName}. If selected, I will follow the brief carefully and ${mission ? `cover this mission: ${mission}` : "complete every required mission"}.`,
    },
  ];
}

export async function POST(request: Request) {
  try {
    if (!isDemoMode()) assertRateLimit(request, "application", { limit: 5 });
    const raw = (await request.json()) as { requirements?: unknown; applicantKeywords?: unknown; language?: unknown };
    if (!raw.requirements) {
      throw new ProviderError("Qwen Cloud", "Campaign requirements are missing", 400);
    }

    const requirements = campaignRequirementsSchema.parse(raw.requirements);
    const language: Locale = raw.language === "ko" ? "ko" : "en";
    const applicantKeywords = typeof raw.applicantKeywords === "string"
      ? raw.applicantKeywords
          .split(/[,\n]/)
          .map((keyword) => keyword.trim())
          .filter(Boolean)
          .slice(0, 12)
          .map((keyword) => keyword.slice(0, 80))
      : [];
    if (isDemoMode()) {
      const businessHighlights = language === "ko"
        ? ["제철 식재료를 활용한 시그니처 런치", "차분한 공간과 정갈한 플레이팅"]
        : ["A seasonal signature lunch", "A calm concept with careful plating"];
      providerLog("Qwen", "Demo pre-visit application message loaded", { variants: 1 });
      await demoPause(620);
      return NextResponse.json<ApplicationGenerationResult>({
        variants: demoApplicationVariants(requirements, applicantKeywords, language),
        businessHighlights,
        researchSources: ["https://search.naver.com/search.naver?where=nexearch&query=%ED%95%98%EB%A3%A8%EC%8B%9D%ED%83%81%20%EC%84%B1%EC%88%98"],
        researchQuery: language === "ko" ? "하루식탁 성수" : "Haru Table Seongsu",
        source: {
          provider: "Qwen Cloud",
          mode: "demo",
          model: "qwen3.5-flash",
          generatedAt: new Date().toISOString(),
          requestId: "demo-qwen-application-01",
        },
      });
    }

    const research = await fetchNaverBusinessResearch({
      brand: requirements.brand,
      campaignName: requirements.campaignName,
      requiredKeywords: requirements.requiredKeywords,
      providedItems: requirements.providedItems,
    });
    const generated = await generateApplicationMessages(
      requirements,
      applicantKeywords,
      language,
      research.content ? { query: research.query, content: research.content } : undefined,
    );
    return NextResponse.json<ApplicationGenerationResult>({
      variants: generated.variants,
      businessHighlights: generated.businessHighlights,
      researchSources: research.content && generated.businessHighlights.length ? research.sourceUrls : [],
      researchQuery: research.content && generated.businessHighlights.length ? research.query : undefined,
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
