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

export const runtime = "nodejs";
export const maxDuration = 120;

function demoApplicationVariants(requirements: CampaignRequirements): ApplicationMessageVariant[] {
  const campaignName = requirements.campaignName || "해당 캠페인";
  const brand = requirements.brand && requirements.brand !== "브랜드 미확인" ? requirements.brand : campaignName;
  const providedItem = requirements.providedItems[0];
  const keywordPlan = requirements.requiredKeywords.length
    ? `${requirements.requiredKeywords.slice(0, 2).join(", ")} 키워드`
    : "안내된 핵심 내용";
  const mission = requirements.otherRequirements[0] || requirements.requiredMentions[0];

  return [
    {
      label: "기본형",
      message: `${campaignName}의 제공 내역과 모집 조건을 확인하고 신청합니다. 선정된다면 ${brand}의 특징과 ${
        mission ? `${mission} 등 주요 미션` : "주요 미션"
      }이 잘 전달되도록 가이드에 맞춰 꼼꼼하게 소개하겠습니다.`,
    },
    {
      label: "콘텐츠 강조형",
      message: `${providedItem ? `${providedItem} 제공 내용과 ` : ""}${keywordPlan}를 확인하고 ${campaignName}에 신청합니다. 선정된다면 요청된 구성과 방문 조건을 지키고, 캠페인의 핵심이 명확히 전달되는 콘텐츠로 정성껏 작성하겠습니다.`,
    },
    {
      label: "간결형",
      message: `${brand} 캠페인에 신청합니다. 선정된다면 안내된 미션과 가이드를 꼼꼼히 반영해 소개하겠습니다.`,
    },
  ];
}

export async function POST(request: Request) {
  try {
    if (!isDemoMode()) assertRateLimit(request, "application", { limit: 5 });
    const raw = (await request.json()) as { requirements?: unknown };
    if (!raw.requirements) {
      throw new ProviderError("Qwen Cloud", "Campaign requirements are missing", 400);
    }

    const requirements = campaignRequirementsSchema.parse(raw.requirements);
    if (isDemoMode()) {
      providerLog("Qwen", "Demo pre-visit application variants loaded", { variants: 3 });
      await demoPause(620);
      return NextResponse.json<ApplicationGenerationResult>({
        variants: demoApplicationVariants(requirements),
        source: {
          provider: "Qwen Cloud",
          mode: "demo",
          model: "qwen3.5-flash",
          generatedAt: new Date().toISOString(),
          requestId: "demo-qwen-application-01",
        },
      });
    }

    const generated = await generateApplicationMessages(requirements);
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
