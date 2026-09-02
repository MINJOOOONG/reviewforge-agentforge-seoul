import { NextResponse } from "next/server";
import { demoPause } from "@/lib/demo";
import { isDemoMode } from "@/lib/env";
import { apiError, ProviderError } from "@/lib/http";
import { generateApplicationMessagesLocally } from "@/lib/local-engine";
import { providerLog } from "@/lib/logger";
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
      { label: "맞춤 신청 문구", message: `${profile}네이버 공개 정보에서 확인한 ${highlight}이 특히 궁금해 ${brand} 캠페인에 신청합니다. 선정된다면 방문 전 공고의 제공 내역과 방문 조건을 다시 꼼꼼히 확인하고 약속된 일정에 맞춰 체험하겠습니다. 현장에서는 메뉴의 전체 모습과 세부 구성이 잘 보이는 사진, 공간의 분위기와 방문 흐름을 이해할 수 있는 사진을 다양하게 직접 촬영하겠습니다. 후기에는 제가 실제로 보고 느낀 점을 중심으로 메뉴와 공간의 특징이 자연스럽게 이어지도록 구성하겠습니다. 필수 키워드와 사진 수, 링크, 해시태그 등 공고의 리뷰 미션도 빠짐없이 점검해 반영하겠습니다. 과장된 표현보다는 솔직한 경험과 정성스러운 사진으로 ${brand}의 매력이 독자에게 충분히 전달되는 읽기 편하고 신뢰할 수 있는 자세한 후기를 작성하겠습니다.` },
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
      message: `${personalProfile}I was especially interested in ${highlight}, based on public Naver information, and would love to apply for ${campaignName}. If selected, I will review the offer, visit conditions, and publishing schedule carefully before attending. During the visit, I will take a varied set of original photos that clearly introduces both the main experience and the atmosphere of the space. I will structure the post around what I genuinely observe and experience, without adding exaggerated or unverified claims. I will also check every required keyword, photo count, link, hashtag, and review mission before publishing${mission ? `, including the requested focus on ${mission}` : ""}. My goal is to create a detailed, thoughtful review that helps readers understand what makes this local experience worth discovering.`,
    },
  ];
}

export async function POST(request: Request) {
  try {
    if (!isDemoMode()) assertRateLimit(request, "application", { limit: 5 });
    const raw = (await request.json()) as {
      requirements?: unknown;
      applicantKeywords?: unknown;
      campaignEvidence?: unknown;
      language?: unknown;
    };
    if (!raw.requirements) {
      throw new ProviderError("Application Writer", "Campaign requirements are missing", 400);
    }

    const requirements = campaignRequirementsSchema.parse(raw.requirements);
    const language: Locale = raw.language === "ko" ? "ko" : "en";
    const campaignEvidence = typeof raw.campaignEvidence === "string" ? raw.campaignEvidence.trim() : "";
    if (campaignEvidence.length > 32_000) {
      throw new ProviderError("Application Writer", "Campaign evidence is too large.", 400);
    }
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
      providerLog("LocalEngine", "Demo pre-visit application message loaded", { variants: 1 });
      await demoPause(620);
      return NextResponse.json<ApplicationGenerationResult>({
        variants: demoApplicationVariants(requirements, applicantKeywords, language),
        businessHighlights,
        researchSources: ["https://search.naver.com/search.naver?where=nexearch&query=%ED%95%98%EB%A3%A8%EC%8B%9D%ED%83%81%20%EC%84%B1%EC%88%98"],
        researchQuery: language === "ko" ? "하루식탁 성수" : "Haru Table Seongsu",
        source: {
          provider: "Local Engine",
          mode: "demo",
          model: "campaign-template-v1",
          generatedAt: new Date().toISOString(),
          requestId: "demo-application-01",
        },
      });
    }

    const localResult = () => {
      const generated = generateApplicationMessagesLocally(requirements, applicantKeywords, language);
      return NextResponse.json<ApplicationGenerationResult>({
        variants: generated.variants,
        businessHighlights: generated.businessHighlights,
        researchSources: [],
        source: {
          provider: "Local Engine",
          mode: "local",
          model: "campaign-template-v1",
          generatedAt: new Date().toISOString(),
        },
      });
    };

    return localResult();
  } catch (error) {
    return apiError(error);
  }
}
