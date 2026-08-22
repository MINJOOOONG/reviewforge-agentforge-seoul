import type { CampaignRequirements } from "@/types/campaign";
import type { ComplianceResult } from "@/types/compliance";
import type { GenerationResult } from "@/types/generation";
import type { MediaAnalysis } from "@/types/media";
import type { Locale } from "@/types/locale";

export function demoPause(milliseconds = 520) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export const DEMO_REQUIREMENTS: CampaignRequirements = {
  campaignName: "Seongsu Haru Table Signature Lunch Campaign",
  brand: "Haru Table",
  providedItems: ["Signature lunch for two"],
  recruitmentConditions: ["Active blogger", "Able to publish a review using original photos"],
  visitConditions: {
    basePartySize: 2,
    maxPartySize: 4,
    additionalPersonFee: 30000,
    additionalPersonAgeThreshold: 7,
    petAllowed: true,
    reservationRequired: true,
    availableTimes: [],
    parkingConditions: null,
    companionConditions: ["Up to four guests may visit"],
    otherConditions: ["Publish within seven days of the visit"],
  },
  reviewRequirements: {
    minimumPhotos: 5,
    minimumVideos: 0,
    minimumCharacters: 700,
    mapLinkRequired: true,
    requiredLinks: ["https://map.naver.com"],
    titleKeywords: ["Seongsu restaurant"],
    bodyKeywords: ["Seongsu restaurant", "Haru Table"],
    customKeywordRequired: true,
    customKeywordCount: 1,
    minimumKeywordCounts: { "Seongsu restaurant": 3, "Haru Table": 2 },
    requiredHashtags: ["#SeongsuRestaurant", "#HaruTable"],
    otherRequiredMissions: ["Introduce both the menu and the atmosphere"],
  },
  keywordRules: {
    requiredKeywords: ["Seongsu restaurant", "Haru Table"],
    titleKeywords: ["Seongsu restaurant"],
    bodyKeywords: ["Seongsu restaurant", "Haru Table"],
    customKeywordRequired: true,
    customKeywordCount: 1,
    minimumOccurrences: 3,
    appliesToTitle: true,
    appliesToBody: true,
  },
  selectionBoosters: [
    { type: "cross_post_social", description: "Can cross-post the review on Instagram or Facebook", required: false },
    { type: "naver_clip", description: "Can create a Naver Clip", required: false },
  ],
  conditionalRequirements: [
    {
      condition: "naver_clip_enabled",
      requirement: "If creating a Clip, place #Sponsored at the very top",
      requiredHashtag: "#Sponsored",
      position: "top",
    },
  ],
  requiredKeywords: ["Seongsu restaurant", "Haru Table"],
  minimumKeywordCounts: {
    "Seongsu restaurant": 3,
    "Haru Table": 2,
  },
  minimumPhotos: 5,
  videoRequired: false,
  minimumCharacters: 700,
  requiredMentions: ["original photos"],
  requiredLinks: ["https://map.naver.com"],
  requiredHashtags: ["#SeongsuRestaurant", "#HaruTable"],
  deadline: "2026-09-05",
  otherRequirements: ["Introduce both the menu and the atmosphere", "Publish within seven days of the visit"],
};

export const DEMO_REQUIREMENTS_KO: CampaignRequirements = {
  ...DEMO_REQUIREMENTS,
  campaignName: "성수 하루식탁 시그니처 런치 체험단",
  brand: "하루식탁",
  providedItems: ["시그니처 런치 2인 식사권"],
  recruitmentConditions: ["블로그 운영자", "직접 촬영한 사진으로 후기 작성 가능자"],
  visitConditions: {
    ...DEMO_REQUIREMENTS.visitConditions,
    companionConditions: ["최대 4인까지 방문 가능"],
    otherConditions: ["방문 후 7일 이내 포스팅"],
  },
  reviewRequirements: {
    ...DEMO_REQUIREMENTS.reviewRequirements,
    titleKeywords: ["성수맛집"],
    bodyKeywords: ["성수맛집", "하루식탁"],
    minimumKeywordCounts: { 성수맛집: 3, 하루식탁: 2 },
    requiredHashtags: ["#성수맛집", "#하루식탁"],
    otherRequiredMissions: ["메뉴와 매장 분위기를 함께 소개"],
  },
  keywordRules: {
    ...DEMO_REQUIREMENTS.keywordRules,
    requiredKeywords: ["성수맛집", "하루식탁"],
    titleKeywords: ["성수맛집"],
    bodyKeywords: ["성수맛집", "하루식탁"],
  },
  selectionBoosters: [
    { type: "cross_post_social", description: "인스타그램 또는 페이스북 등 SNS 동시 리뷰 가능", required: false },
    { type: "naver_clip", description: "네이버 클립 작성 가능", required: false },
  ],
  conditionalRequirements: [{ condition: "naver_clip_enabled", requirement: "클립 작성 시 최상단에 #협찬 해시태그 기재", requiredHashtag: "#협찬", position: "top" }],
  requiredKeywords: ["성수맛집", "하루식탁"],
  minimumKeywordCounts: { 성수맛집: 3, 하루식탁: 2 },
  requiredMentions: ["직접 촬영"],
  requiredHashtags: ["#성수맛집", "#하루식탁"],
  otherRequirements: ["메뉴와 매장 분위기를 함께 소개", "방문 후 7일 이내 포스팅"],
};

const categories = ["hero", "food", "menu", "interior", "exterior", "atmosphere"] as const;

export function demoMediaAnalysis(fileNames: string[], language: Locale = "en"): MediaAnalysis[] {
  return fileNames.map((fileName, index) => ({
    fileName,
    category: categories[index % categories.length],
    qualityScore: Math.max(0.78, 0.96 - index * 0.025),
    relevanceScore: Math.max(0.8, 0.97 - index * 0.02),
    caption: (language === "ko" ? [
      "메인 메뉴를 가까이에서 담은 대표 사진",
      "메뉴의 질감과 구성이 잘 보이는 음식 사진",
      "주문 정보를 확인할 수 있는 메뉴판 사진",
      "좌석과 조도를 확인할 수 있는 매장 내부",
      "방문 동선을 보여주는 매장 외관",
      "식사 경험의 분위기를 보완하는 장면",
    ] : [
      "Hero shot showing the main dish up close",
      "Food detail showing texture and composition",
      "Menu board that provides ordering context",
      "Interior showing seating and lighting",
      "Storefront establishing the visit location",
      "Atmosphere shot that completes the dining story",
    ])[index % 6],
  }));
}

export function demoGeneration(
  requirements: CampaignRequirements,
  media: MediaAnalysis[],
  note: string,
  language: Locale = "en",
): Omit<GenerationResult, "source"> {
  const photos = media.length ? media : demoMediaAnalysis(["IMG_1023.jpg", "IMG_1024.jpg", "IMG_1025.jpg"], language);
  const marker = (index: number) => {
    const item = photos[index];
    if (!item) return "";
    return `[PHOTO: ${item.fileName} — ${item.caption ?? item.category}]`;
  };
  const extraMarkers = photos
    .slice(6)
    .map((item) => `[PHOTO: ${item.fileName} — ${item.caption ?? item.category}]`)
    .join("\n\n");
  const groundedNote = note.trim() || "No personal note was provided, so this draft uses only details visible in the photos.";
  const brand = requirements.brand || "Haru Table";

  if (language === "ko") {
    const markers = photos.map((item) => `[PHOTO: ${item.fileName} — ${item.caption ?? item.category}]`);
    const blogDraft = `성수맛집에서 만난 정갈한 한 끼, ${brand} 방문 기록

이번 글은 ${brand}에서 직접 촬영한 사진과 방문 당시 남긴 메모만을 바탕으로 정리한 솔직한 후기입니다. 확인하지 못한 가격이나 운영 정보는 임의로 덧붙이지 않고, 실제로 보고 느낀 메뉴와 공간의 인상을 사진 순서에 맞춰 소개합니다.

${markers[4] ?? ""}

먼저 매장 외관을 촬영해 방문 동선을 보여주었습니다. 처음 방문하는 분들이 위치를 확인할 때 참고하기 좋은 장면입니다. 정확한 영업시간과 주차 정보는 방문 전 공식 채널에서 다시 확인하는 것을 권합니다.

${markers[3] ?? ""}

매장 안에서는 좌석 배치와 조명처럼 사진으로 확인할 수 있는 부분을 중심으로 담았습니다. 과장된 표현보다 직접 촬영한 장면 그대로 보여주는 것이 공간의 분위기를 이해하는 데 더 도움이 된다고 생각했습니다.

${markers[2] ?? ""}

메뉴판도 함께 촬영했습니다. 메뉴 구성과 가격은 촬영 시점 이후 달라질 수 있으므로 사진과 매장의 최신 안내를 함께 확인해 주세요.

${markers[0] ?? ""}

메인 메뉴는 전체 구성이 한눈에 보이도록 먼저 촬영했습니다. 성수맛집 후기를 볼 때 메뉴의 모습이 궁금한 분들을 위해 대표 사진으로 배치했습니다.

${markers[1] ?? ""}

가까이에서 보니 재료의 질감과 조합이 더 잘 보였습니다. 제가 현장에서 남긴 실제 느낌은 “${groundedNote}”입니다. 이 문장은 사용자가 입력한 경험을 꾸미지 않고 그대로 반영했습니다.

${markers[5] ?? ""}

${brand}에서 직접 확인한 메뉴와 매장 분위기를 사진 흐름에 맞춰 소개하니 방문 과정이 자연스럽게 이어졌습니다. 성수맛집을 찾으며 사진으로 메뉴와 공간을 비교하는 분들에게 작은 참고가 되길 바랍니다.

사진마다 무엇을 보여주는지 설명을 덧붙여 음식과 공간의 특징을 한 번에 파악할 수 있도록 구성했습니다. 성수맛집과 하루식탁이라는 필수 키워드도 문맥을 해치지 않는 범위에서 자연스럽게 사용했고, 직접 경험하지 않은 내용은 단정하지 않았습니다. 방문을 고민하는 분들이 실제 사진과 솔직한 메모를 중심으로 판단할 수 있는 기록이 되기를 바랍니다.

${markers.slice(6).join("\n\n")}

매장 정보: https://map.naver.com

#성수맛집 #하루식탁`;
    return {
      title: `성수맛집 ${brand}, 사진으로 남긴 방문 후기`,
      applicationMessage: `${brand}의 메뉴와 공간을 직접 경험하고 정성스럽게 기록하고 싶어 신청합니다. 선정된다면 직접 촬영한 사진과 솔직한 메모를 바탕으로 필수 키워드와 가이드를 꼼꼼히 반영하겠습니다.`,
      blogDraft,
      photoOrder: photos.map((item, index) => ({ fileName: item.fileName, category: item.category, reason: `${index + 1}번째 흐름에 어울리는 ${item.category} 사진` })),
      unverifiedClaims: ["주차 가능 여부", "정확한 영업시간"],
    };
  }

  const blogDraft = `A Thoughtful Meal in Seongsu — My Visit to ${brand}

I recently visited ${brand} while looking for a relaxed place to eat in Seongsu. This honest review is grounded in photos I took at the restaurant and notes I wrote during the visit. I have not added details that were not visible or personally experienced. Here is a careful look at the menu and atmosphere for anyone searching for a Seongsu restaurant.

${marker(4)}

I started with the storefront and entrance. This photo should make the location easier to recognize on a first visit. Exact opening hours and parking availability were not confirmed in the campaign brief, so check the official channel before visiting.

${marker(3)}

Inside, I focused on details that the photo can support, including the seating layout and lighting. Showing the scene as I photographed it felt more useful than exaggerating the atmosphere at ${brand}.

${marker(2)}

I also photographed the menu before ordering. Please use the image itself for item names and prices, since the selection may change after the date of this visit.

${marker(0)}

Then the main dish arrived. I photographed the full composition first and placed this image early because it works well as the hero shot. If you compare photos before choosing a Seongsu restaurant, this is the best place to start.

${marker(1)}

A closer photo shows the texture and combination of ingredients more clearly. My firsthand note from the visit was: “${groundedNote}” I kept that experience intact rather than embellishing it. Tastes vary, so consider it alongside the photo.

${marker(5)}

Looking back on the visit, the photo order creates a natural path through the menu and space I personally observed at ${brand}. I have not made claims about service, facilities, or accessibility that the evidence cannot support. Contact the venue directly if you need those details.

${extraMarkers}

I hope this record helps anyone comparing the menu and atmosphere before choosing a Seongsu restaurant. If you plan to visit ${brand}, remember to check the latest operating information.

Location: https://map.naver.com

#SeongsuRestaurant #HaruTable`;

  return {
    title: `Seongsu Restaurant ${brand}: A Thoughtful Meal in Photos`,
    applicationMessage: `I enjoy discovering and documenting new places and menus, so I would love to join the ${brand} campaign. If selected, I will create a thoughtful review using my original photos and honest notes while carefully following every keyword and mission.`,
    blogDraft,
    photoOrder: photos.map((item, index) => ({
      fileName: item.fileName,
      category: item.category,
      reason: [
        "Hero image that clearly introduces the main dish",
        "Detail shot that follows the hero image",
        "Information shot that adds ordering context",
        "Interior shot introducing the atmosphere and seating",
        "Storefront shot that opens the visit journey",
        "Atmosphere shot that closes the review",
      ][index % 6],
    })),
    unverifiedClaims: ["Parking availability", "Exact opening hours"],
  };
}

export type ComplianceInput = {
  requirements: CampaignRequirements;
  title?: string;
  draft: string;
  uploadedPhotoCount: number;
  uploadedVideoCount: number;
  unverifiedClaims?: string[];
  enabledConditions?: string[];
};

export function runDeterministicCompliance(input: ComplianceInput): Omit<ComplianceResult, "source"> {
  const checks: ComplianceResult["checks"] = [];
  const publishableDraft = input.draft.replace(/^\s*\[PHOTO:.*\]\s*$/gm, "");
  const textLength = Array.from(publishableDraft.replace(/\s/g, "")).length;
  const placedPhotoCount = new Set(
    Array.from(input.draft.matchAll(/^\s*\[PHOTO:\s*(.+?)(?:\s+[—–-]\s+.+)?\]\s*$/gm), (match) => match[1].trim()),
  ).size;
  const verifiedPhotoCount = Math.min(input.uploadedPhotoCount, placedPhotoCount);
  const review = input.requirements.reviewRequirements;
  const keywordRules = input.requirements.keywordRules;
  const minimumPhotos = review.minimumPhotos ?? input.requirements.minimumPhotos;
  const minimumVideos = review.minimumVideos ?? (input.requirements.videoRequired ? 1 : 0);
  const minimumCharacters = review.minimumCharacters ?? input.requirements.minimumCharacters;
  const minimumKeywordCounts = { ...review.minimumKeywordCounts, ...input.requirements.minimumKeywordCounts };
  const requiredKeywords = Array.from(new Set([...keywordRules.requiredKeywords, ...input.requirements.requiredKeywords]));

  for (const keyword of requiredKeywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const actual = (input.draft.match(new RegExp(escaped, "g")) ?? []).length;
    const expected = minimumKeywordCounts[keyword] ?? keywordRules.minimumOccurrences ?? 1;
    checks.push({
      name: `Keyword · ${keyword}`,
      status: actual >= expected ? "PASS" : "FAIL",
      detail: `${actual} / ${expected} uses`,
    });
  }

  for (const keyword of keywordRules.titleKeywords) {
    const included = (input.title ?? "").includes(keyword);
    checks.push({ name: `Title keyword · ${keyword}`, status: included ? "PASS" : "FAIL", detail: included ? "Included in title" : "Missing from title" });
  }

  for (const keyword of keywordRules.bodyKeywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const actual = (input.draft.match(new RegExp(escaped, "g")) ?? []).length;
    const expected = minimumKeywordCounts[keyword] ?? keywordRules.minimumOccurrences ?? 1;
    checks.push({ name: `Body keyword · ${keyword}`, status: actual >= expected ? "PASS" : "FAIL", detail: `${actual} / ${expected} uses` });
  }

  checks.push({
    name: "Body length",
    status: textLength >= minimumCharacters ? "PASS" : "FAIL",
    detail: `${textLength.toLocaleString("en-US")} / ${minimumCharacters.toLocaleString("en-US")} characters`,
  });
  checks.push({
    name: "Placed photos",
    status: verifiedPhotoCount >= minimumPhotos ? "PASS" : "FAIL",
    detail: `${verifiedPhotoCount} / ${minimumPhotos} photos placed in draft`,
  });

  if (minimumVideos > 0) {
    checks.push({
      name: "Required videos",
      status: input.uploadedVideoCount >= minimumVideos ? "PASS" : "FAIL",
      detail: `${input.uploadedVideoCount} / ${minimumVideos} videos`,
    });
  }

  for (const hashtag of Array.from(new Set([...review.requiredHashtags, ...input.requirements.requiredHashtags]))) {
    checks.push({
      name: `Hashtag · ${hashtag}`,
      status: input.draft.includes(hashtag) ? "PASS" : "FAIL",
      detail: input.draft.includes(hashtag) ? "Included in body" : "Missing from body",
    });
  }

  for (const link of Array.from(new Set([...review.requiredLinks, ...input.requirements.requiredLinks]))) {
    checks.push({
      name: "Required link",
      status: input.draft.includes(link) ? "PASS" : "FAIL",
      detail: input.draft.includes(link) ? link : `${link} missing`,
    });
  }

  if (review.mapLinkRequired) {
    const included = /(map\.naver\.com|place\.map\.kakao\.com|maps\.app\.goo\.gl|google\.[^/\s]+\/maps)/i.test(input.draft);
    checks.push({ name: "Map location link", status: included ? "PASS" : "FAIL", detail: included ? "Map link included" : "Map link missing" });
  }

  for (const mention of input.requirements.requiredMentions) {
    checks.push({
      name: `Required mention · ${mention}`,
      status: input.draft.includes(mention) ? "PASS" : "FAIL",
      detail: input.draft.includes(mention) ? "Included in body" : "Missing from body",
    });
  }

  for (const claim of input.unverifiedClaims ?? []) {
    checks.push({
      name: `Fact check · ${claim}`,
      status: "WARNING",
      detail: "Not confirmed by the available evidence",
    });
  }

  for (const booster of input.requirements.selectionBoosters) {
    checks.push({ name: `Selection booster · ${booster.description}`, status: "OPTIONAL", detail: "Optional · Excluded from score" });
  }

  for (const conditional of input.requirements.conditionalRequirements) {
    if (!(input.enabledConditions ?? []).includes(conditional.condition)) {
      checks.push({ name: `Conditional · ${conditional.requirement}`, status: "NA", detail: `${conditional.condition} not enabled` });
      continue;
    }
    const passed = !conditional.requiredHashtag
      || (conditional.position === "top"
        ? input.draft.split("\n").find((line) => line.trim())?.includes(conditional.requiredHashtag) === true
        : input.draft.includes(conditional.requiredHashtag));
    checks.push({ name: `Conditional · ${conditional.requirement}`, status: passed ? "PASS" : "FAIL", detail: passed ? "Condition met" : "Condition not met" });
  }

  const summary = {
    pass: checks.filter((check) => check.status === "PASS").length,
    warning: checks.filter((check) => check.status === "WARNING").length,
    fail: checks.filter((check) => check.status === "FAIL").length,
  };
  const scoredChecks = checks.filter((check) => ["PASS", "WARNING", "FAIL"].includes(check.status));
  const possible = Math.max(scoredChecks.length, 1);
  const score = Math.round(((summary.pass + summary.warning * 0.5) / possible) * 100);

  return { score, checks, summary };
}
