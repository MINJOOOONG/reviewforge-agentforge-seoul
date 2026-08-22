import type { CampaignRequirements } from "@/types/campaign";
import type { ComplianceResult } from "@/types/compliance";
import type { GenerationResult } from "@/types/generation";
import type { MediaAnalysis } from "@/types/media";

export function demoPause(milliseconds = 520) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export const DEMO_REQUIREMENTS: CampaignRequirements = {
  campaignName: "성수 하루식탁 시그니처 런치 체험단",
  brand: "하루식탁",
  providedItems: ["시그니처 런치 2인 식사권"],
  recruitmentConditions: ["블로그 운영자", "직접 촬영한 사진으로 후기 작성 가능자"],
  visitConditions: ["선정 후 예약 필수", "방문 후 7일 이내 포스팅"],
  requiredKeywords: ["성수맛집", "하루식탁"],
  minimumKeywordCounts: {
    성수맛집: 3,
    하루식탁: 2,
  },
  minimumPhotos: 5,
  videoRequired: false,
  minimumCharacters: 700,
  requiredMentions: ["직접 촬영"],
  requiredLinks: ["https://map.naver.com"],
  requiredHashtags: ["#성수맛집", "#하루식탁"],
  deadline: "2026-09-05",
  otherRequirements: ["메뉴와 매장 분위기를 함께 소개", "방문 후 7일 이내 포스팅"],
};

const categories = ["hero", "food", "menu", "interior", "exterior", "atmosphere"] as const;

export function demoMediaAnalysis(fileNames: string[]): MediaAnalysis[] {
  return fileNames.map((fileName, index) => ({
    fileName,
    category: categories[index % categories.length],
    qualityScore: Math.max(0.78, 0.96 - index * 0.025),
    relevanceScore: Math.max(0.8, 0.97 - index * 0.02),
    caption: [
      "메인 메뉴를 가까이에서 담은 대표 사진",
      "메뉴의 질감과 구성이 잘 보이는 음식 사진",
      "주문 정보를 확인할 수 있는 메뉴판 사진",
      "좌석과 조도를 확인할 수 있는 매장 내부",
      "방문 동선을 보여주는 매장 외관",
      "식사 경험의 분위기를 보완하는 장면",
    ][index % 6],
  }));
}

export function demoGeneration(
  requirements: CampaignRequirements,
  media: MediaAnalysis[],
  note: string,
): Omit<GenerationResult, "source"> {
  const photos = media.length ? media : demoMediaAnalysis(["IMG_1023.jpg", "IMG_1024.jpg", "IMG_1025.jpg"]);
  const marker = (index: number) => {
    const item = photos[index];
    if (!item) return "";
    return `[PHOTO: ${item.fileName} — ${item.caption ?? item.category}]`;
  };
  const extraMarkers = photos
    .slice(6)
    .map((item) => `[PHOTO: ${item.fileName} — ${item.caption ?? item.category}]`)
    .join("\n\n");
  const groundedNote = note.trim() || "개인 메모가 입력되지 않아 사진으로 확인되는 내용만 정리했습니다.";
  const brand = requirements.brand || "하루식탁";

  const blogDraft = `성수에서 만난 정갈한 한 끼, ${brand} 방문 기록

요즘 성수에서 천천히 식사할 곳을 찾다가 ${brand}에 다녀왔어요. 이번 글은 매장에서 직접 촬영한 사진과 방문 당시 남겨 둔 메모를 바탕으로 정리한 솔직한 기록입니다. 사진에서 확인되지 않거나 제가 직접 경험하지 않은 정보는 억지로 덧붙이지 않았어요. 성수맛집을 찾는 분들께 메뉴와 공간의 인상을 차분히 전해 볼게요.

${marker(4)}

먼저 외관과 입구 쪽을 한 장 남겼습니다. 처음 찾아가는 분이라면 이 사진을 기준으로 매장을 확인하면 좋을 것 같아요. 정확한 영업시간과 주차 가능 여부는 캠페인 페이지에서 확인되지 않아 방문 전 공식 채널을 한 번 더 확인해 주세요.

${marker(3)}

안으로 들어오면 이런 분위기였습니다. 좌석 배치와 조도처럼 사진으로 보이는 부분을 중심으로 담아 봤어요. 과장된 표현보다는 실제로 촬영한 장면 그대로 전달하는 편이 ${brand}의 분위기를 이해하는 데 더 도움이 될 것 같았습니다.

${marker(2)}

주문 전에 메뉴판도 촬영했습니다. 사진 속 메뉴명과 가격은 이미지에서 직접 확인해 주세요. 촬영 시점 이후 구성이나 가격이 달라질 수 있어 이 글에서는 확인되지 않은 수치를 따로 적지 않았습니다.

${marker(0)}

드디어 오늘의 메인 메뉴가 나왔습니다. 한눈에 구성이 보이도록 먼저 전체 모습을 담았어요. 대표 사진으로 쓰기 좋은 컷이라 글의 앞부분에 배치했습니다. 성수맛집 후기를 볼 때 메뉴의 전체 구성이 궁금했던 분들이라면 이 사진부터 천천히 살펴보세요.

${marker(1)}

조금 더 가까이에서 촬영하니 재료의 질감과 조합이 잘 보였습니다. 제가 현장에서 적어 둔 실제 느낌은 다음과 같아요. “${groundedNote}” 이 부분은 제공된 문구를 꾸미지 않고 그대로 반영했습니다. 사람마다 취향은 다를 수 있으니 사진과 함께 참고해 주세요.

${marker(5)}

식사를 마무리하며 전체 경험을 다시 돌아봤습니다. ${brand}에서 직접 확인한 메뉴와 공간을 사진 순서에 맞춰 소개하니 방문 흐름이 자연스럽게 이어졌어요. 확인되지 않은 친절도, 편의시설, 접근성 같은 내용은 단정하지 않았습니다. 그런 정보가 필요하다면 방문 전에 매장에 직접 문의하는 편이 정확합니다.

${extraMarkers}

성수맛집을 찾으면서 사진으로 메뉴와 분위기를 꼼꼼히 비교하고 싶은 분께 이번 기록이 작은 참고가 되었으면 합니다. ${brand} 방문을 계획한다면 최신 운영 정보도 함께 확인해 보세요.

매장 정보: https://map.naver.com

#성수맛집 #하루식탁`;

  return {
    title: `성수맛집 ${brand}, 사진으로 남긴 정갈한 한 끼`,
    applicationMessage: `평소 새로운 공간과 메뉴를 직접 경험하고 기록하는 것을 좋아해 ${brand} 체험단에 신청합니다. 직접 촬영한 사진과 솔직한 메모를 바탕으로, 필수 키워드와 가이드를 꼼꼼히 반영한 정성스러운 후기를 작성하겠습니다.`,
    blogDraft,
    photoOrder: photos.map((item, index) => ({
      fileName: item.fileName,
      category: item.category,
      reason: [
        "첫 화면에서 메뉴를 명확히 보여주는 대표 컷",
        "대표 사진 다음에 디테일을 이어 보여주는 컷",
        "주문 맥락을 보완하는 정보 컷",
        "공간의 분위기와 좌석을 소개하는 컷",
        "방문 동선을 시작하는 외관 컷",
        "후기의 여운을 정리하는 분위기 컷",
      ][index % 6],
    })),
    unverifiedClaims: ["주차 가능 여부", "정확한 영업시간"],
  };
}

export type ComplianceInput = {
  requirements: CampaignRequirements;
  draft: string;
  uploadedPhotoCount: number;
  uploadedVideoCount: number;
  unverifiedClaims?: string[];
};

export function runDeterministicCompliance(input: ComplianceInput): Omit<ComplianceResult, "source"> {
  const checks: ComplianceResult["checks"] = [];
  const textLength = input.draft.replace(/\s/g, "").length;

  for (const keyword of input.requirements.requiredKeywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const actual = (input.draft.match(new RegExp(escaped, "g")) ?? []).length;
    const expected = input.requirements.minimumKeywordCounts[keyword] ?? 1;
    checks.push({
      name: `Keyword · ${keyword}`,
      status: actual >= expected ? "PASS" : "FAIL",
      detail: `${actual} / ${expected}회`,
    });
  }

  checks.push({
    name: "본문 글자 수",
    status: textLength >= input.requirements.minimumCharacters ? "PASS" : "FAIL",
    detail: `${textLength.toLocaleString("ko-KR")} / ${input.requirements.minimumCharacters.toLocaleString("ko-KR")}자`,
  });
  checks.push({
    name: "업로드 사진",
    status: input.uploadedPhotoCount >= input.requirements.minimumPhotos ? "PASS" : "FAIL",
    detail: `${input.uploadedPhotoCount} / ${input.requirements.minimumPhotos}장`,
  });

  if (input.requirements.videoRequired) {
    checks.push({
      name: "필수 동영상",
      status: input.uploadedVideoCount > 0 ? "PASS" : "FAIL",
      detail: input.uploadedVideoCount > 0 ? `${input.uploadedVideoCount}개 업로드` : "필수지만 업로드되지 않음",
    });
  }

  for (const hashtag of input.requirements.requiredHashtags) {
    checks.push({
      name: `Hashtag · ${hashtag}`,
      status: input.draft.includes(hashtag) ? "PASS" : "FAIL",
      detail: input.draft.includes(hashtag) ? "본문에 포함" : "본문에서 찾을 수 없음",
    });
  }

  for (const link of input.requirements.requiredLinks) {
    checks.push({
      name: "필수 링크",
      status: input.draft.includes(link) ? "PASS" : "FAIL",
      detail: input.draft.includes(link) ? link : `${link} 누락`,
    });
  }

  for (const mention of input.requirements.requiredMentions) {
    checks.push({
      name: `필수 언급 · ${mention}`,
      status: input.draft.includes(mention) ? "PASS" : "FAIL",
      detail: input.draft.includes(mention) ? "본문에 포함" : "본문에서 찾을 수 없음",
    });
  }

  for (const claim of input.unverifiedClaims ?? []) {
    checks.push({
      name: `사실 확인 · ${claim}`,
      status: "WARNING",
      detail: "출처에서 확인되지 않아 단정하지 않음",
    });
  }

  const summary = {
    pass: checks.filter((check) => check.status === "PASS").length,
    warning: checks.filter((check) => check.status === "WARNING").length,
    fail: checks.filter((check) => check.status === "FAIL").length,
  };
  const possible = Math.max(checks.length, 1);
  const score = Math.round(((summary.pass + summary.warning * 0.5) / possible) * 100);

  return { score, checks, summary };
}
