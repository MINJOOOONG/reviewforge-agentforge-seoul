import { NextResponse } from "next/server";
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
  if (language === "ko") {
    const brand = requirements.brand || "해당 업체";
    const profile = applicantKeywords.length ? `저는 ${applicantKeywords.join(", ")}이라는 강점이 있습니다. ` : "";
    return [
      { label: "기본형", message: `${profile}${brand} 캠페인의 제공 내용과 모집 조건을 확인하고 신청합니다. 선정된다면 방문 조건과 미션을 꼼꼼히 지켜 매력적인 후기를 작성하겠습니다.` },
      { label: "콘텐츠 강조형", message: `${profile}${brand}의 메뉴와 공간이 잘 전달될 수 있도록 직접 촬영한 사진과 저만의 관점을 담아 소개하고 싶어 신청합니다. 선정된다면 공고의 키워드와 리뷰 미션을 빠짐없이 반영하겠습니다.` },
      { label: "간결형", message: `${profile}${brand} 캠페인에 신청합니다. 선정된다면 가이드를 꼼꼼히 반영한 정성스러운 후기를 작성하겠습니다.` },
    ];
  }
  const campaignName = requirements.campaignName || "this campaign";
  const brand = requirements.brand && requirements.brand !== "Brand not identified" ? requirements.brand : campaignName;
  const providedItem = requirements.providedItems[0];
  const keywordPlan = requirements.requiredKeywords.length
    ? `the ${requirements.requiredKeywords.slice(0, 2).join(" and ")} keywords`
    : "the campaign's key points";
  const mission = requirements.otherRequirements[0] || requirements.requiredMentions[0];
  const personalProfile = applicantKeywords.length > 0
    ? `My background includes ${applicantKeywords.join(", ")}. `
    : "";

  return [
    {
      label: "Balanced",
      message: `${personalProfile}I reviewed the offer and selection criteria for ${campaignName} and would love to apply. If selected, I will follow the brief carefully, communicate ${brand}'s character, and ${mission ? `cover this mission: ${mission}` : "complete every required mission"}.`,
    },
    {
      label: "Content-focused",
      message: `${personalProfile}I reviewed ${providedItem ? `the ${providedItem} offer and ` : ""}${keywordPlan} before applying to ${campaignName}. If selected, I will respect the visit conditions and use my interests and strengths to create clear, campaign-relevant content.`,
    },
    {
      label: "Concise",
      message: `${personalProfile}I would love to join the ${brand} campaign. If selected, I will create a careful, engaging review that follows every mission in the brief.`,
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
      providerLog("Qwen", "Demo pre-visit application variants loaded", { variants: 3 });
      await demoPause(620);
      return NextResponse.json<ApplicationGenerationResult>({
        variants: demoApplicationVariants(requirements, applicantKeywords, language),
        source: {
          provider: "Qwen Cloud",
          mode: "demo",
          model: "qwen3.5-flash",
          generatedAt: new Date().toISOString(),
          requestId: "demo-qwen-application-01",
        },
      });
    }

    const generated = await generateApplicationMessages(requirements, applicantKeywords, language);
    return NextResponse.json<ApplicationGenerationResult>({
      variants: generated.variants,
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
