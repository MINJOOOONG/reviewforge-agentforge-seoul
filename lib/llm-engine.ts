import { generateJsonWithLlm, type LlmJsonSchema } from "@/lib/llm";
import { campaignRequirementsSchema, parseJsonFromModel } from "@/lib/schemas";
import type { ApplicationMessageVariant } from "@/types/application";
import type { CampaignRequirements } from "@/types/campaign";
import type { Locale } from "@/types/locale";
import { z } from "zod";

const stringList = { type: "array", items: { type: "string" } } as const;

const extractionSchema: LlmJsonSchema = {
  type: "object",
  properties: {
    brand: { type: "string", nullable: true },
    campaignName: { type: "string", nullable: true },
    providedItems: stringList,
    recruitmentConditions: stringList,
    minimumPhotos: { type: "integer", nullable: true },
    minimumVideos: { type: "integer", nullable: true },
    minimumCharacters: { type: "integer", nullable: true },
    titleKeywords: stringList,
    bodyKeywords: stringList,
    requiredKeywords: stringList,
    minimumKeywordOccurrences: { type: "integer", nullable: true },
    requiredHashtags: stringList,
    requiredLinks: stringList,
    mapLinkRequired: { type: "boolean", nullable: true },
    deadline: { type: "string", nullable: true },
    selectionBoosters: stringList,
    otherRequiredMissions: stringList,
  },
  required: ["brand", "campaignName", "providedItems", "requiredKeywords", "otherRequiredMissions"],
};

const extractionResponseSchema = z.object({
  brand: z.string().max(200).nullable().default(null),
  campaignName: z.string().max(300).nullable().default(null),
  providedItems: z.array(z.string().max(300)).max(30).default([]),
  recruitmentConditions: z.array(z.string().max(500)).max(30).default([]),
  minimumPhotos: z.number().int().min(0).max(100).nullable().default(null),
  minimumVideos: z.number().int().min(0).max(100).nullable().default(null),
  minimumCharacters: z.number().int().min(0).max(100_000).nullable().default(null),
  titleKeywords: z.array(z.string().max(100)).max(30).default([]),
  bodyKeywords: z.array(z.string().max(100)).max(30).default([]),
  requiredKeywords: z.array(z.string().max(100)).max(30).default([]),
  minimumKeywordOccurrences: z.number().int().min(0).max(100).nullable().default(null),
  requiredHashtags: z.array(z.string().max(100)).max(50).default([]),
  requiredLinks: z.array(z.string().max(2_048)).max(20).default([]),
  mapLinkRequired: z.boolean().nullable().default(null),
  deadline: z.string().max(100).nullable().default(null),
  selectionBoosters: z.array(z.string().max(500)).max(30).default([]),
  otherRequiredMissions: z.array(z.string().max(500)).max(50).default([]),
});

const EXTRACTION_SYSTEM = [
  "You extract the review requirements of an influencer campaign (체험단) listing into JSON.",
  "Rules:",
  "- Copy values from the page. Never infer, translate, round, or invent a requirement that is not written there.",
  "- `brand` is the shop or business name only — strip category prefixes (강남맛집), region tags ([서울 강남]), and label prefixes (Title:, 제목:).",
  "- `campaignName` is what the campaign is called, not the provided items.",
  "- `providedItems` is what the reviewer receives (제공 내역).",
  "- Counts (photos, videos, characters) must be the required minimum. If the page marks a number as 권장/선택/최대/이하, it is not a requirement — return null.",
  "- `requiredKeywords` are keywords the post must contain; put them in `titleKeywords` / `bodyKeywords` too when the page says where they belong.",
  "- `otherRequiredMissions` holds required missions not captured by the other fields, each as one short line copied from the page.",
  "- Return null (or an empty array) for anything the page does not state. An empty answer is correct; a guessed one is not.",
].join("\n");

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function preferred<T>(fromModel: T | null | undefined, fromLocal: T): T {
  return fromModel === null || fromModel === undefined ? fromLocal : fromModel;
}

function preferredList(fromModel: string[], fromLocal: string[]) {
  return fromModel.length ? unique(fromModel) : fromLocal;
}

/**
 * Extracts requirements with the model, using the local regex extraction as the floor: any field
 * the model leaves empty keeps the locally parsed value, so an LLM answer can only add detail.
 */
export async function extractCampaignRequirementsWithLlm(
  pageText: string,
  localRequirements: CampaignRequirements,
  sourceUrl: string,
): Promise<CampaignRequirements> {
  const raw = await generateJsonWithLlm({
    system: EXTRACTION_SYSTEM,
    prompt: `Campaign listing:\n\n${pageText.slice(0, 24_000)}`,
    schema: extractionSchema,
    temperature: 0,
    maxOutputTokens: 4_096,
  });
  const model = parseJsonFromModel(raw, extractionResponseSchema);

  const localReview = localRequirements.reviewRequirements;
  const titleKeywords = preferredList(model.titleKeywords, localReview.titleKeywords);
  const bodyKeywords = preferredList(model.bodyKeywords, localReview.bodyKeywords);
  const requiredKeywords = unique([
    ...preferredList(model.requiredKeywords, localRequirements.requiredKeywords),
    ...titleKeywords,
    ...bodyKeywords,
  ]);
  const minimumPhotos = preferred(model.minimumPhotos, localReview.minimumPhotos);
  const minimumVideos = preferred(model.minimumVideos, localReview.minimumVideos);
  const minimumCharacters = preferred(model.minimumCharacters, localReview.minimumCharacters);
  const occurrences = preferred(model.minimumKeywordOccurrences, localRequirements.keywordRules.minimumOccurrences);
  const minimumKeywordCounts = Object.fromEntries(
    requiredKeywords.map((keyword) => [keyword, localRequirements.minimumKeywordCounts[keyword] ?? occurrences ?? 1]),
  );
  const requiredLinks = preferredList(model.requiredLinks, localRequirements.requiredLinks);
  const requiredHashtags = preferredList(model.requiredHashtags, localRequirements.requiredHashtags);
  const otherRequirements = preferredList(model.otherRequiredMissions, localRequirements.otherRequirements);

  return campaignRequirementsSchema.parse({
    ...localRequirements,
    campaignName: model.campaignName?.trim() || localRequirements.campaignName,
    brand: model.brand?.trim() || localRequirements.brand,
    providedItems: preferredList(model.providedItems, localRequirements.providedItems),
    recruitmentConditions: preferredList(model.recruitmentConditions, localRequirements.recruitmentConditions),
    reviewRequirements: {
      ...localReview,
      minimumPhotos,
      minimumVideos,
      minimumCharacters,
      mapLinkRequired: preferred(model.mapLinkRequired, localReview.mapLinkRequired),
      requiredLinks,
      titleKeywords,
      bodyKeywords,
      minimumKeywordCounts,
      requiredHashtags,
      otherRequiredMissions: otherRequirements,
    },
    keywordRules: {
      ...localRequirements.keywordRules,
      requiredKeywords,
      titleKeywords,
      bodyKeywords,
      minimumOccurrences: occurrences,
      appliesToTitle: titleKeywords.length ? true : localRequirements.keywordRules.appliesToTitle,
      appliesToBody: bodyKeywords.length ? true : localRequirements.keywordRules.appliesToBody,
    },
    selectionBoosters: model.selectionBoosters.length
      ? model.selectionBoosters.map((description) => ({ type: "other", description, required: false as const }))
      : localRequirements.selectionBoosters,
    requiredKeywords,
    minimumKeywordCounts,
    minimumPhotos: minimumPhotos ?? 0,
    videoRequired: (minimumVideos ?? 0) > 0,
    minimumCharacters: minimumCharacters ?? 0,
    requiredLinks,
    requiredHashtags,
    deadline: preferred(model.deadline?.trim() || null, localRequirements.deadline),
    otherRequirements,
    sourceUrl,
  });
}

const applicationSchema: LlmJsonSchema = {
  type: "object",
  properties: { message: { type: "string" } },
  required: ["message"],
};

const applicationResponseSchema = z.object({ message: z.string().min(1).max(4_000) });

const APPLICATION_SYSTEM_KO = [
  "당신은 체험단에 지원하는 블로거 본인입니다. 공고 담당자가 읽을 '신청 한마디'를 1인칭으로 씁니다.",
  "",
  "형식:",
  "- 두 문단. 문단 사이는 빈 줄 하나. 제목, 목록, 이모지, 해시태그, 마크다운은 넣지 않습니다.",
  "- 400~600자.",
  "- 첫 문단: 내가 어떤 사람인지 → 평소 어떻게 기록하는지 → 이 공고에 끌린 이유 → 선정되면 후기에 무엇을 담을지 구체적으로.",
  "- 둘째 문단: 왜 나를 뽑으면 좋은지 → 공고에 적힌 작성 조건을 지키겠다는 약속 → 마무리 인사.",
  "",
  "말투:",
  "- 정중하지만 딱딱하지 않게. '~습니다'와 '~해요'를 자연스럽게 섞습니다.",
  "- 사람이 직접 쓴 것처럼. 틀에 박힌 지원서 문구나 광고 카피처럼 들리면 안 됩니다.",
  "",
  "지켜야 할 것:",
  "- 아직 방문하지 않았습니다. 맛, 서비스, 분위기를 겪은 것처럼 쓰면 안 되고 전부 미래형으로 씁니다.",
  "- 지원자에 대해서는 주어진 특성만 씁니다. 나이, 직업, 사는 곳, 블로그 규모, 팔로워 수를 지어내지 않습니다.",
  "- 특성이 비어 있으면 지원자를 특정하지 말고, 기록을 정성껏 남기겠다는 태도만 담습니다.",
  "- 업체명과 제공 내역은 공고에 적힌 표기를 그대로 씁니다.",
  "- 필수 키워드가 있으면 억지로 나열하지 말고, 지키겠다는 약속으로 한 번만 언급합니다.",
].join("\n");

const APPLICATION_SYSTEM_EN = [
  "You are the blogger applying to this campaign. Write the application message in the first person, for the campaign manager to read.",
  "",
  "Format:",
  "- Two paragraphs separated by one blank line. No headings, lists, emoji, hashtags, or markdown.",
  "- 900-1,300 characters.",
  "- First paragraph: who I am, how I usually document a visit, what drew me to this campaign, and what the review will cover.",
  "- Second paragraph: why I am a good fit, a promise to meet the brief's writing requirements, and a short closing.",
  "",
  "Voice: warm and specific, like a person wrote it — not a form letter or ad copy.",
  "",
  "Constraints:",
  "- The visit has not happened yet. Never describe taste, service, or atmosphere as experienced; keep everything in the future tense.",
  "- Use only the applicant traits provided. Never invent an age, job, location, blog size, or follower count.",
  "- If no traits are given, do not characterize the applicant beyond a commitment to document the visit carefully.",
  "- Write the brand name and provided items exactly as the brief spells them.",
  "- Mention required keywords once as a promise to follow the brief, never as a keyword list.",
].join("\n");

function requirementsBrief(requirements: CampaignRequirements, language: Locale) {
  const review = requirements.reviewRequirements;
  const known = (value: string) => (/not identified/i.test(value) ? null : value);
  const lines = [
    ["업체명 / Brand", known(requirements.brand)],
    ["캠페인 / Campaign", known(requirements.campaignName)],
    ["제공 내역 / Provided", requirements.providedItems.join(" · ")],
    ["최소 사진 수 / Minimum photos", requirements.minimumPhotos || review.minimumPhotos],
    ["최소 글자 수 / Minimum characters", requirements.minimumCharacters || review.minimumCharacters],
    ["필수 키워드 / Required keywords", requirements.requiredKeywords.join(", ")],
    ["필수 해시태그 / Required hashtags", requirements.requiredHashtags.join(" ")],
    ["기타 미션 / Other missions", requirements.otherRequirements.slice(0, 6).join(" / ")],
    ["선정 우대 / Selection boosters", requirements.selectionBoosters.map((item) => item.description).slice(0, 3).join(" / ")],
  ];
  return lines
    .filter(([, value]) => value !== null && value !== undefined && value !== "" && value !== 0)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n") || (language === "ko" ? "(공고에서 확인된 항목 없음)" : "(nothing confirmed from the brief)");
}

export async function generateApplicationMessageWithLlm(
  requirements: CampaignRequirements,
  applicantKeywords: string[],
  language: Locale,
  campaignEvidence = "",
): Promise<ApplicationMessageVariant[]> {
  const traits = applicantKeywords.join(", ");
  const prompt = [
    language === "ko" ? "## 공고에서 확인된 내용" : "## Confirmed from the brief",
    requirementsBrief(requirements, language),
    "",
    language === "ko" ? "## 지원자가 입력한 특성" : "## Applicant traits",
    traits || (language === "ko" ? "(입력 없음)" : "(none provided)"),
    campaignEvidence
      ? `\n${language === "ko" ? "## 공고 원문 발췌" : "## Brief excerpt"}\n${campaignEvidence.slice(0, 6_000)}`
      : "",
    "",
    language === "ko" ? "위 내용으로 신청 한마디를 써 주세요." : "Write the application message from the above.",
  ].join("\n");

  const raw = await generateJsonWithLlm({
    system: language === "ko" ? APPLICATION_SYSTEM_KO : APPLICATION_SYSTEM_EN,
    prompt,
    schema: applicationSchema,
    temperature: 0.85,
    maxOutputTokens: 2_048,
  });
  const { message } = parseJsonFromModel(raw, applicationResponseSchema);
  return [{ label: language === "ko" ? "맞춤 신청 문구" : "Recommended message", message: message.trim() }];
}
