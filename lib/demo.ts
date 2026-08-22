import type { CampaignRequirements } from "@/types/campaign";
import type { ComplianceResult } from "@/types/compliance";
import type { GenerationResult } from "@/types/generation";
import type { MediaAnalysis } from "@/types/media";

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
    minimumVideos: 1,
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

const categories = ["hero", "food", "menu", "interior", "exterior", "atmosphere"] as const;

export function demoMediaAnalysis(fileNames: string[]): MediaAnalysis[] {
  return fileNames.map((fileName, index) => ({
    fileName,
    category: categories[index % categories.length],
    qualityScore: Math.max(0.78, 0.96 - index * 0.025),
    relevanceScore: Math.max(0.8, 0.97 - index * 0.02),
    caption: [
      "Hero shot showing the main dish up close",
      "Food detail showing texture and composition",
      "Menu board that provides ordering context",
      "Interior showing seating and lighting",
      "Storefront establishing the visit location",
      "Atmosphere shot that completes the dining story",
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
  const groundedNote = note.trim() || "No personal note was provided, so this draft uses only details visible in the photos.";
  const brand = requirements.brand || "Haru Table";

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
  const textLength = input.draft.replace(/\s/g, "").length;
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
    name: "Uploaded photos",
    status: input.uploadedPhotoCount >= minimumPhotos ? "PASS" : "FAIL",
    detail: `${input.uploadedPhotoCount} / ${minimumPhotos} photos`,
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
