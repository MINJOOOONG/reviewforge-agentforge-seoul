import { campaignRequirementsSchema } from "@/lib/schemas";
import type { ApplicationMessageVariant } from "@/types/application";
import type { CampaignRequirements } from "@/types/campaign";
import type { GenerationResult } from "@/types/generation";
import type { Locale } from "@/types/locale";
import type { MediaAnalysis } from "@/types/media";

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function normalizedLines(raw: string) {
  return raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/^[\s•·★※└▶▷-]+/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function firstNumber(raw: string | undefined) {
  if (!raw) return null;
  const value = Number(raw.replaceAll(",", ""));
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function maximumMatch(text: string, patterns: RegExp[], maximum: number) {
  const values: number[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      const lineStart = text.lastIndexOf("\n", index) + 1;
      const nextLine = text.indexOf("\n", index + match[0].length);
      const lineEnd = nextLine === -1 ? text.length : nextLine;
      const leading = text.slice(Math.max(lineStart, index - 16), index);
      const trailing = text.slice(index + match[0].length, Math.min(lineEnd, index + match[0].length + 24));
      const optionalInsideMatch = /(?:선택|권장|최대|이하|이내|내외|정도|약\s*\d|optional|recommended|maximum|up\s+to)/i.test(match[0]);
      const optionalBeforeMatch = /(?:최대|약|권장|선택|또는|혹은|maximum|up\s+to|about|approximately)\s*$/i.test(leading);
      const optionalAfterMatch = /^\s*(?:[()（）]\s*)?(?:이하|이내|내외|정도|권장|선택|자율|또는|혹은|생략\s*가능|optional|recommended|or\s+less|at\s+most|approximately)/i.test(trailing);
      if (optionalInsideMatch || optionalBeforeMatch || optionalAfterMatch) continue;
      const value = firstNumber(match[1]);
      if (value !== null && value <= maximum) values.push(value);
    }
  }
  return values.length ? Math.max(...values) : null;
}

function payloadAfterLabel(lines: string[], label: RegExp) {
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(label);
    if (!match) continue;
    const inline = lines[index].slice((match.index ?? 0) + match[0].length).replace(/^\s*[:：]\s*/, "").trim();
    return inline || lines[index + 1];
  }
}

function splitTerms(raw: string | undefined) {
  if (!raw) return [];
  const cleaned = raw
    .replace(/(?:각각?|모두)?\s*\d+\s*회(?:\s*이상)?/g, "")
    .replace(/[()（）]\s*\d+\s*회(?:\s*이상)?\s*[)）]/g, "")
    .replace(/^(?:필수\s*)?(?:제목|본문|내용)?\s*(?:키워드|해시태그|태그)\s*[:：]?\s*/i, "")
    .trim();
  const separated = cleaned.includes(",") || /[|｜、;/\n]/.test(cleaned)
    ? cleaned.split(/[,，|｜、;/\n]/)
    : cleaned.split(/\s{2,}|\s+(?=[#])/);
  return unique(separated.map((term) => term.replace(/^['"“”‘’]+|['"“”‘’.]+$/g, "").trim()))
    .filter((term) => term.length <= 100 && !/^(없음|해당\s*없음|-)$/.test(term));
}

function findCampaignIdentity(lines: string[]) {
  const first = lines[0] || "";
  const explicitCampaign = payloadAfterLabel(lines, /^(?:캠페인명|체험단명|공고명)\s*[:：]?/);
  const explicitBrand = payloadAfterLabel(lines, /^(?:업체명|상호명|브랜드명?|매장명)\s*[:：]?/);
  const socialTitle = first.match(/^(?:강남맛집(?:\s*체험단)?\s+)?(.+?)\s+-\s+(.+)$/);
  return {
    campaignName: (explicitCampaign || socialTitle?.[2] || first || "Campaign name not identified").slice(0, 300),
    brand: (socialTitle?.[1] || explicitBrand || "Brand not identified").slice(0, 200),
  };
}

function selectEvidence(text: string) {
  if (text.length <= 32_000) return text;
  const lines = normalizedLines(text);
  const relevant = lines.filter((line) => /제공|키워드|해시태그|사진|영상|글자|방문|예약|주차|미션|주의|필수|마감|링크|required|keyword|photo|video|character|visit/i.test(line));
  return [text.slice(0, 10_000), relevant.join("\n").slice(0, 19_000), text.slice(-2_000)].join("\n\n").slice(0, 32_000);
}

export function extractCampaignRequirementsLocally(
  pageText: string,
  sourceUrl: string,
  language: Locale = "ko",
) {
  const noticeIndex = pageText.search(/\nNOTICE(?:\s*\n|$)/i);
  const campaignText = noticeIndex > 0 ? pageText.slice(0, noticeIndex) : pageText;
  const lines = normalizedLines(campaignText);
  const identity = findCampaignIdentity(lines);
  const keywordHeading = lines.findIndex((line) => /^(?:필수\s*)?키워드\s*[:：]?$/.test(line));
  const genericKeywordPayload = keywordHeading >= 0 ? lines[keywordHeading + 1] : payloadAfterLabel(lines, /^(?:필수\s*)?키워드\s*[:：]/);
  let genericKeywords = splitTerms(genericKeywordPayload);
  if (genericKeywords.length === 1 && genericKeywordPayload && !/[,，|｜、;/]/.test(genericKeywordPayload)) {
    const compactTerms = genericKeywordPayload.split(/\s+/).filter((term) => term.length >= 2 && term.length <= 30);
    if (compactTerms.length > 1) genericKeywords = unique(compactTerms);
  }
  const titleKeywords = unique([
    ...splitTerms(payloadAfterLabel(lines, /^(?:제목|타이틀)\s*(?:필수\s*)?키워드\s*[:：]?/)),
    ...(/키워드는?\s*제목\s*\d+\s*회/.test(campaignText) ? genericKeywords : []),
  ]);
  const bodyKeywords = unique([
    ...splitTerms(payloadAfterLabel(lines, /^(?:본문|내용)\s*(?:필수\s*)?키워드\s*[:：]?/)),
    ...(/키워드는?[\s\S]{0,30}본문\s*\d+\s*회/.test(campaignText) ? genericKeywords : []),
  ]);
  const requiredKeywords = unique([...genericKeywords, ...titleKeywords, ...bodyKeywords]);
  const titleCount = firstNumber(campaignText.match(/키워드는?[\s\S]{0,20}제목\s*(\d[\d,]*)\s*회/)?.[1]);
  const bodyCount = firstNumber(campaignText.match(/키워드는?[\s\S]{0,40}본문\s*(\d[\d,]*)\s*회/)?.[1]);
  const minimumKeywordCounts = Object.fromEntries(requiredKeywords.map((keyword) => [keyword, bodyCount ?? titleCount ?? 1]));

  const minimumPhotos = maximumMatch(campaignText, [
    /(?:사진|이미지|포토)[^\n]{0,20}?(?:최소\s*)?(\d[\d,]*)\s*(?:장|컷|개)(?:\s*이상)?/g,
    /(\d[\d,]*)\s*(?:장|컷|개)(?:\s*이상)?[^\n]{0,12}(?:사진|이미지|포토)/g,
  ], 100);
  let minimumVideos = maximumMatch(campaignText, [
    /(?:동영상|영상|릴스|클립)[^\n]{0,20}?(?:최소\s*)?(\d[\d,]*)\s*(?:개|편)(?:\s*이상)?/g,
    /(\d[\d,]*)\s*(?:개|편)(?:\s*이상)?[^\n]{0,12}(?:동영상|영상|릴스|클립)/g,
  ], 100);
  if (minimumVideos === null && /동영상을?\s*포함/.test(campaignText) && !/동영상[^\n]{0,20}(?:선택|권장)/.test(campaignText)) minimumVideos = 1;
  const minimumCharacters = maximumMatch(campaignText, [
    /(?:텍스트|본문|원고|글자\s*수)[^\n]{0,25}?(\d[\d,]*)\s*(?:자|글자)(?:\s*이상)?/g,
    /(\d[\d,]*)\s*(?:자|글자)(?:\s*이상)?[^\n]{0,20}(?:서술|작성|포스팅|본문)/g,
  ], 100_000);

  const provided = payloadAfterLabel(lines, /^\[?\s*(?:제공\s*(?:내역|사항|혜택)|체험\s*(?:상품|내용))\s*(?:\]|[:：]|$)/);
  const providedItems = provided && !/^(?:없음|해당\s*없음|-)$/.test(provided)
    ? [provided.replace(/^[-:：\s]+/, "").slice(0, 300)]
    : [];
  const hashLines = lines.filter((line) => /(?:필수|반드시).{0,20}(?:해시태그|태그)|(?:해시태그|태그).{0,20}(?:필수|반드시)/.test(line) && !/(작성|진행|구매평)\s*시/.test(line));
  const requiredHashtags = unique(hashLines.flatMap((line) => line.match(/#[\p{L}\p{N}_]+/gu) ?? []));
  const urls = unique(Array.from(campaignText.matchAll(/https?:\/\/[^\s<>"'\[\]{}()]+/gi), (match) => match[0].replace(/[.,;:!?]+$/, "")))
    .filter((url) => url !== sourceUrl && url.length <= 2_048);
  const requiredLinks = /(?:구매|지도|제품|업체|필수)?\s*링크[^\n]{0,20}(?:첨부|삽입|등록|필수)/.test(campaignText)
    ? urls.filter((url) => /smartstore\.naver\.com\/.+\/products\/|map\.naver\.com|place\.map\.kakao\.com/i.test(url)).slice(0, 20)
    : [];
  const mapLinkRequired = /지도[^\n]{0,20}링크[^\n]{0,20}(?:첨부|삽입|등록|필수)/.test(campaignText) || requiredLinks.some((url) => /map\.|\/maps/i.test(url));

  const boosterLines = unique(lines.filter((line) => /선정\s*(?:확률|가능성).{0,20}(?:높|우대)|우선\s*선정/.test(line)).map((line) => line.slice(0, 500)));
  const conditionalLines = unique(lines.filter((line) => /(?:작성|진행|제작|구매평)\s*시/.test(line) && /필수|반드시|#/.test(line)).map((line) => line.slice(0, 500)));
  const missionLines = unique(lines.filter((line) =>
    /(?:반드시|필수|최소|이상|첨부|포함|기재|등록)/.test(line)
    && /사진|영상|본문|텍스트|키워드|링크|해시태그|리뷰/.test(line)
    && !/구매평\s*작성\s*시/.test(line),
  ).filter((line) => {
    if (minimumPhotos !== null && /사진[^\n]{0,30}\d[\d,]*\s*(?:장|개)/.test(line)) return false;
    if (minimumCharacters !== null && /(?:텍스트|본문|원고|글자)[^\n]{0,30}\d[\d,]*\s*(?:자|글자)/.test(line)) return false;
    if (requiredKeywords.length && /키워드[^\n]{0,40}(?:제목|본문|\d+\s*회)/.test(line)) return false;
    if (requiredLinks.length && /구매\s*링크[^\n]{0,20}(?:첨부|삽입)/.test(line)) return false;
    return true;
  }).map((line) => line.slice(0, 500))).slice(0, 30);
  const dateMatch = campaignText.match(/(?:신청|모집|캠페인)?\s*마감(?:일)?[^\d]{0,12}(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  const deadline = dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}` : null;
  const allRequiredKeywords = unique([...requiredKeywords, ...titleKeywords, ...bodyKeywords]);

  const requirements = campaignRequirementsSchema.parse({
    campaignName: identity.campaignName,
    brand: identity.brand,
    providedItems,
    recruitmentConditions: [],
    visitConditions: {},
    reviewRequirements: {
      minimumPhotos,
      minimumVideos,
      minimumCharacters,
      mapLinkRequired,
      requiredLinks,
      titleKeywords,
      bodyKeywords,
      minimumKeywordCounts,
      requiredHashtags,
      otherRequiredMissions: missionLines,
    },
    keywordRules: {
      requiredKeywords: allRequiredKeywords,
      titleKeywords,
      bodyKeywords,
      minimumOccurrences: bodyCount ?? null,
      appliesToTitle: titleKeywords.length ? true : null,
      appliesToBody: bodyKeywords.length ? true : null,
    },
    selectionBoosters: boosterLines.map((description) => ({ type: "other", description, required: false as const })),
    conditionalRequirements: conditionalLines.map((requirement, index) => ({
      condition: `conditional_${index + 1}`,
      requirement,
      requiredHashtag: requirement.match(/#[\p{L}\p{N}_]+/u)?.[0] ?? null,
      position: /최상단/.test(requirement) ? "top" : null,
    })),
    requiredKeywords: allRequiredKeywords,
    minimumKeywordCounts,
    minimumPhotos: minimumPhotos ?? 0,
    videoRequired: (minimumVideos ?? 0) > 0,
    minimumCharacters: minimumCharacters ?? 0,
    requiredMentions: [],
    requiredLinks,
    requiredHashtags,
    deadline,
    otherRequirements: missionLines,
    sourceUrl,
  });

  return { requirements, evidence: selectEvidence(campaignText), language };
}

function pick<T>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generateApplicationMessagesLocally(
  requirements: CampaignRequirements,
  applicantKeywords: string[] = [],
  language: Locale = "ko",
): { variants: ApplicationMessageVariant[]; businessHighlights: string[] } {
  const campaign = requirements.campaignName || (language === "ko" ? "이번 체험단" : "this campaign");
  const brand = /not identified/i.test(requirements.brand) ? "" : requirements.brand;
  const offer = requirements.providedItems[0];
  const profile = applicantKeywords.join(", ");
  const mission = [
    requirements.minimumPhotos ? (language === "ko" ? `사진 ${requirements.minimumPhotos}장` : `${requirements.minimumPhotos} photos`) : "",
    requirements.minimumCharacters ? (language === "ko" ? `본문 ${requirements.minimumCharacters.toLocaleString("ko-KR")}자` : `${requirements.minimumCharacters.toLocaleString("en-US")} characters`) : "",
    requirements.requiredKeywords.length ? (language === "ko" ? `필수 키워드 ${requirements.requiredKeywords.join(", ")}` : `required keywords ${requirements.requiredKeywords.join(", ")}`) : "",
  ].filter(Boolean).join(", ");

  const message = language === "ko"
    ? buildKoreanApplicationMessage({ campaign, brand, offer, profile, photos: requirements.minimumPhotos })
    : buildEnglishApplicationMessage({ campaign, brand, offer, profile, mission });

  return {
    variants: [{ label: language === "ko" ? "맞춤 신청 문구" : "Recommended message", message }],
    businessHighlights: unique([offer, ...requirements.otherRequirements]).slice(0, 3),
  };
}

function sentenceEnd(playfulChance = 0.35, pool: string[] = [" :)", " ♡", "!"]) {
  return Math.random() < playfulChance ? pick(pool) : ".";
}

/** Pulls a short, quotable bit out of a long offer line so the message can react to it
 *  the way a person would ("무려 8코스") instead of pasting the whole notice text.
 *  `impressive` gates the "무려" phrasing, which reads sarcastic on small offers like "2잔". */
function offerHighlight(offer?: string) {
  if (!offer) return { text: "", impressive: false };
  const countable = offer.match(/(\d+)\s*(코스|종|가지|인분|잔|병|매|회)/);
  if (countable) {
    return {
      text: `${countable[1]}${countable[2]}`,
      impressive: countable[2] === "코스" || Number(countable[1]) >= 5,
    };
  }
  return { text: offer.length <= 20 ? offer : "", impressive: false };
}

function buildKoreanApplicationMessage(input: { campaign: string; brand: string; offer?: string; profile: string; photos: number }) {
  const { campaign, brand, offer, profile, photos } = input;
  const place = brand || campaign;

  const profileLine = profile
    ? pick([
        `${profile} — 이런 제 취향이랑 이번 체험단이 정말 잘 맞을 것 같아 지원해요${sentenceEnd(0.5, [" :)"])}`,
        `${profile}. 그래서 이런 자리는 늘 진심으로 준비하는 편이에요${sentenceEnd(0.5, [" :)"])}`,
        `간단히 소개드리면 ${profile} — 공고 보자마자 이건 꼭 신청해야겠다 싶었어요${sentenceEnd(0.5, ["!"])}`,
      ])
    : `${campaign} 공고 보자마자 이건 꼭 신청해야겠다 싶었어요${sentenceEnd(0.5, ["!"])}`;

  const goalLine = pick([
    `단순히 먹고 끝나는 체험이 아니라, 매장 분위기부터 플레이팅, 메뉴별 특징과 맛까지 꼼꼼하게 기록해서 보는 분들이 "여기는 한번 가보고 싶다!"는 생각이 들 수 있는 리뷰를 남기겠습니다!`,
    `방문하고 끝이 아니라 공간 분위기, 플레이팅, 메뉴 하나하나의 특징까지 자세히 담아서 읽는 분들이 "여기 꼭 가봐야겠다" 싶어지는 후기로 만들고 싶어요!`,
  ]);

  const brandLine = brand
    ? pick([
        `특히 ${brand}처럼 플레이팅과 공간 분위기가 예쁜 곳은 사진 찍는 재미까지 있을 것 같아 꼭 경험해보고 싶어요.`,
        `${brand} 사진만 봐도 분위기가 정말 좋아 보여서 직접 담아보고 싶은 마음이 컸어요.`,
      ])
    : "";

  const blogLine = pick([
    `현재 블로그도 꾸준히 키우고 있어서 사진은 다양한 구도로 정성스럽게 촬영하고, 매력이 잘 전달되도록 후기 역시 성의 있게 작성할 자신 있습니다${sentenceEnd(0.5, [" :)"])}`,
    `블로그를 꾸준히 운영하고 있어서 사진 구도나 글 구성은 늘 신경 써서 준비하는 편이에요${sentenceEnd(0.5, [" :)"])}`,
    `${photos ? `사진도 ${photos}장 이상 다양한 구도로 정성껏 담아서, 메뉴와 공간의 매력이 잘 전달되도록 준비하겠습니다.` : `사진은 다양한 구도로 정성껏 담아서 메뉴와 공간의 매력이 잘 전달되도록 준비하겠습니다.`}`,
  ]);

  const highlight = offerHighlight(offer);
  const offerLine = highlight.impressive
    ? pick([
        `체험권이 무려 ${highlight.text} 구성인 만큼 흐름과 각 메뉴의 특징까지 하나하나 담아서 정성껏 소개하겠습니다.`,
        `${highlight.text} 구성이라니 더 기대돼요! 하나하나 놓치지 않고 꼼꼼히 기록해볼게요.`,
      ])
    : highlight.text
      ? pick([
          `제공해주시는 ${highlight.text} 구성, 하나하나 놓치지 않고 꼼꼼히 담아볼게요!`,
          `${highlight.text} 구성이 어떤 매력일지 궁금해서 더 기대돼요.`,
        ])
      : pick([
          `제공해주시는 구성이 정말 알차 보여서 하나하나 놓치지 않고 담아보고 싶어요.`,
          "",
        ]);

  const closing = pick([
    `소중한 기회 주시면 정말 예쁘고 꼼꼼한 리뷰로 보답할게요! 꼭 방문해보고 싶습니다${sentenceEnd(0.7, [" ♡", "!"])}`,
    `기회 주시면 성심껏 다녀와서 정성스러운 후기로 보답하겠습니다! 잘 부탁드려요${sentenceEnd(0.7, [" ♡", "!"])}`,
    `${place} 꼭 한번 방문해보고 싶어요! 좋은 기회 주시면 정말 감사하겠습니다${sentenceEnd(0.7, [" ♡", "!"])}`,
  ]);

  return [profileLine, goalLine, brandLine, blogLine, offerLine, closing]
    .filter(Boolean)
    .join(" ");
}

function buildEnglishApplicationMessage(input: { campaign: string; brand: string; offer?: string; profile: string; mission: string }) {
  const { campaign, brand, offer, profile, mission } = input;

  const opener = pick([
    `I saw ${campaign} and knew right away I wanted to apply.`,
    `${brand ? `I've had my eye on ${brand} for a while` : `I've been following campaigns like this`}, so I'm excited to apply for ${campaign}.`,
    `I came across ${campaign} and it's exactly the kind of experience I love writing about.`,
  ]);

  const profileLine = profile
    ? pick([
        `A bit about me: ${profile} — it's the kind of background that makes me take visits like this seriously.`,
        `I bring ${profile} to the table, which I think shows in how I document a visit.`,
      ])
    : "";

  const offerLine = offer
    ? pick([
        `Honestly, ${offer} is what caught my attention first.`,
        `The ${offer} part of the offer is what really drew me in.`,
      ])
    : "";

  const brandLine = brand ? `I'd love to introduce ${brand} in a way that feels genuine and easy to follow.` : "";

  const commitLine = pick([
    `If selected, I'll double-check the schedule and every instruction before the visit and stick to it.`,
    `I'll go back over the offer details and visit conditions once more before attending, and follow the agreed process.`,
  ]);

  const photoLine = pick([
    `On site, I'll take a real mix of photos — the overall vibe and the small details too.`,
    `I'll shoot a variety of angles so readers can follow the whole experience, not just one shot.`,
  ]);

  const honestyLine = pick([
    `I'll write only about what I actually saw and felt, no exaggeration.`,
    `No claims about things I didn't personally experience — just an honest account.`,
  ]);

  const missionLine = mission ? `I'll also make sure to cover ${mission} before publishing.` : "";

  const closing = pick([
    `Hope this could be the start of a good collaboration — thank you!`,
    `Thanks for considering me, I'll make it count.`,
  ]);

  return [opener, profileLine, offerLine, brandLine, commitLine, photoLine, honestyLine, missionLine, closing]
    .filter(Boolean)
    .join(" ");
}

const localCategories = ["hero", "food", "menu", "interior", "exterior", "atmosphere", "other"] as const;

export function analyzeMediaLocally(fileNames: string[], language: Locale = "ko"): MediaAnalysis[] {
  return fileNames.map((fileName, index) => ({
    fileName,
    category: localCategories[index % localCategories.length],
    qualityScore: 0.8,
    relevanceScore: 0.8,
    caption: language === "ko" ? `직접 업로드한 체험 사진 ${index + 1}` : `Uploaded experience photo ${index + 1}`,
  }));
}

function characterCount(value: string) {
  return Array.from(value.replace(/^\s*\[PHOTO:.*\]\s*$/gm, "").replace(/\s/g, "")).length;
}

/** Picks from `pool` without repeating anything already in `used`, so photo captions
 *  don't all collapse onto the same sentence. Falls back to the pool once exhausted. */
function pickUnused(pool: string[], used: Set<string>) {
  const fresh = pool.filter((line) => !used.has(line));
  const chosen = pick(fresh.length ? fresh : pool);
  used.add(chosen);
  return chosen;
}

const koPhotoFrames: Record<string, string[]> = {
  exterior: [
    "입구는 이렇게 생겼어요! 간판이 크지 않아서 처음 가시는 분들은 이 사진 참고하시면 좋을 것 같아요~",
    "요기가 입구예요! 골목이라 헤맬까 걱정했는데 딱 보이더라고요 ㅎㅎ",
  ],
  interior: [
    "안에 들어가니까 분위기가 진짜 좋더라고요! 자리에 앉자마자 사진부터 찍었어요 ㅋㅋ",
    "내부는 이런 느낌이에요~ 테이블 간격이 넉넉해서 편하게 있다 왔습니다!",
  ],
  atmosphere: [
    "이 각도에서 보면 분위기가 한눈에 들어와요!",
    "조명이 어떤지 궁금하실까봐 이 컷도 찍어봤어요 :)",
  ],
  food: [
    "나오자마자 바로 한 컷!! 플레이팅이 너무 예뻐서 그냥 못 지나가겠더라고요~",
    "이건 진짜 사진으로 담아야 한다 싶었어요! 색감 보이시나요..??",
    "가까이서도 한 장 찍어봤어요! 구성이 어떤지 잘 보이시죵?",
  ],
  menu: [
    "메뉴 궁금하실 것 같아서 메뉴판도 찍어왔습니당!",
    "주문하실 때 참고하시라고 메뉴판도 올려둘게요~",
  ],
  hero: [
    "이번 방문에서 제일 기억에 남는 장면이에요! 대표 사진으로 골랐습니다 (*´∀｀*)",
    "한 장만 고르라고 하면 무조건 이 사진이에요!!",
  ],
  other: [
    "이 장면도 같이 보시면 좋을 것 같아서 넣어봤어요~",
    "설명이 필요할까 싶었는데 분위기가 잘 담겨서 같이 올립니당!",
  ],
};

const koReaderQuestions = [
  "여러분은 이런 곳 가면 사진부터 찍는 편이신가요..?? 저는 무조건 찍고 시작해요 ㅋㅋ",
  "여러분만의 맛집 판별 기준 같은 거 있으신가요..??",
  "이런 분위기 좋아하시는 분들 계실 것 같은데 어떠신가요~?",
];

/** Splits the visitor's own note into reusable sentence fragments so the draft can
 *  weave them through the photos instead of quoting the whole note once. */
function noteFragments(note: string) {
  return note
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 6);
}

function occurrences(value: string, term: string) {
  return term ? value.split(term).length - 1 : 0;
}

export function generateReviewLocally(
  requirements: CampaignRequirements,
  media: MediaAnalysis[],
  personalNote: string,
  language: Locale = "ko",
): Omit<GenerationResult, "source"> {
  const review = requirements.reviewRequirements;
  const brand = /not identified/i.test(requirements.brand) ? "" : requirements.brand;
  const campaign = requirements.campaignName || brand || (language === "ko" ? "이번 체험" : "This experience");
  const titleKeywords = unique([...review.titleKeywords, ...requirements.keywordRules.titleKeywords]);
  const bodyKeywords = unique([
    ...requirements.requiredKeywords,
    ...requirements.keywordRules.requiredKeywords,
    ...requirements.keywordRules.bodyKeywords,
    ...review.bodyKeywords,
  ]);
  const minimumCounts = { ...review.minimumKeywordCounts, ...requirements.minimumKeywordCounts };
  const requiredMentions = unique(requirements.requiredMentions);
  const requiredLinks = unique([...review.requiredLinks, ...requirements.requiredLinks]);
  if (review.mapLinkRequired && !requiredLinks.some((link) => /map\.|\/maps/i.test(link))) {
    requiredLinks.push(`https://map.naver.com/p/search/${encodeURIComponent(brand || campaign)}`);
  }
  const requiredHashtags = unique([...review.requiredHashtags, ...requirements.requiredHashtags]);
  const minimumCharacters = Math.max(review.minimumCharacters ?? 0, requirements.minimumCharacters ?? 0);
  const title = unique([...titleKeywords, brand || campaign]).join(" · ");
  const note = personalNote.trim();
  const offer = requirements.providedItems[0];
  const fragments = language === "ko" ? noteFragments(note) : [];
  const paragraphs = language === "ko" ? [
    pick([
      `안녕하세요~ 오늘은 ${brand || campaign} 다녀온 후기 들고 왔어요 :)`,
      `안녕하세요! ${brand || campaign} 다녀왔습니당 (*´∀｀*)`,
      `안녕하세요~ 얼마 전에 다녀온 ${brand || campaign} 후기 남겨볼게요!`,
    ]),
    fragments[0]
      ? `${fragments[0]} 이 기억이 제일 먼저 떠오르더라고요 ㅎㅎ`
      : "사진 많이 찍어왔으니까 천천히 보여드릴게요~",
    offer ? `제공받은 건 ${offer}이었어요!` : "",
    pick([
      "사진은 방문한 순서대로 올려둘게요! 처음 가시는 분들도 따라오기 편하실 거예요~",
      "그럼 바로 사진부터 보여드릴게요! 순서대로 올려둘게요 :)",
    ]),
  ].filter(Boolean) : [
    `After completing ${campaign}, I organized my original photos and firsthand notes in a clear sequence. I have included only what I actually experienced and have not filled any gaps with guesses.`,
    `${note ? `My note immediately after the visit was: “${note}”` : "No separate visit note was provided, so this draft follows only the uploaded photo sequence."} I kept that evidence at the center of the story instead of exaggerating the experience.`,
    `${offer ? `The campaign listed ${offer}, and I organized the post around that experience.` : "I cross-checked the campaign brief while organizing this review."} The aim is to make the visit easy for a reader to follow.`,
    `I placed the photos in a simple narrative order and connected them only with observations supported by my note. This keeps the review useful without adding unverified details.`,
  ];

  const usedFrames = new Set<string>();
  const usedLeads = new Set<string>();
  media.forEach((item, index) => {
    paragraphs.push(`[PHOTO: ${item.fileName} — ${item.caption ?? item.category}]`);
    if (language !== "ko") {
      paragraphs.push(`This is uploaded photo ${index + 1}. I placed it here to continue the visit story and avoided claims about taste or service that the image and note cannot support.`);
      return;
    }
    const caption = item.caption?.trim();
    // Frames never take a particle after the caption, which would break on names
    // whose final sound the engine cannot infer.
    const lead = caption && !/^직접 업로드한/.test(caption)
      ? pickUnused([`${caption} 사진이에요. `, `${caption} 모습이에요. `, `${caption}부터 볼게요. `, `${caption}, 이렇게 담겼어요. `], usedLeads)
      : "";
    const frame = pickUnused(koPhotoFrames[item.category] ?? koPhotoFrames.other, usedFrames);
    paragraphs.push(`${lead}${frame}`);
  });

  // The visitor's remaining notes go in one block after the photos — pinning them to
  // individual photos misattributes them (a course-pacing note under an exterior shot).
  if (language === "ko" && fragments.length > 1) {
    paragraphs.push(`그리고 기억에 남는 건 이런 것들이었어요! ${fragments.slice(1).join(" ")}`);
  }
  if (language === "ko") paragraphs.push(pick(koReaderQuestions));

  const closingPool = language === "ko" ? [
    `사진으로 다 전해지지 않는 부분도 있어서, 궁금한 거 있으시면 댓글로 편하게 물어봐 주세요~`,
    `방문 계획 있으시면 예약이랑 영업시간은 미리 한 번 확인해보시는 걸 추천드려요!`,
    `같은 곳을 가도 느낌은 다를 수 있으니 사진 위주로 참고해주시면 좋을 것 같아요 :)`,
    `사진은 전부 직접 찍은 거예요! 보정 없이 그대로 올렸습니당`,
    `${brand ? `${brand} ` : ""}가보실까 고민 중이신 분들께 도움이 됐으면 좋겠어요!`,
    `사진 순서는 실제로 다녀온 순서 그대로라 따라 보시면 동선이 그려지실 거예요~`,
    `괜찮게 보셨다면 저장해두셨다가 방문하실 때 꺼내보셔도 좋을 것 같아요 ㅎㅎ`,
    `기록 안 해두면 금방 까먹어서 기억 남아있을 때 바로 정리했어요!`,
    `메뉴 구성이나 가격은 바뀔 수 있으니 방문 전에 한 번 더 확인해보세요!`,
    `사진이 많아서 스크롤 길어졌는데 끝까지 봐주셔서 감사해요 ㅎㅎ`,
    `저는 이런 곳 다녀오면 사진 정리하는 게 은근 재밌더라고요~`,
    `혹시 다녀오시게 되면 어떠셨는지 댓글로 알려주셔도 좋을 것 같아요!`,
    `주차나 웨이팅 관련해서는 미리 찾아보고 가시는 걸 추천드릴게요~`,
    `사진으로 보시는 것보다 실제로 가보시면 또 다른 느낌일 거예요 :)`,
    `비슷한 곳 후기도 종종 올리고 있으니 관심 있으시면 구경 오세요~`,
  ] : [
    `My priority was to preserve a genuine visitor's point of view. I focused on what happened in sequence and what I recorded, rather than filling the post with promotional claims.`,
    `Each photo contributes a different moment to the story. Keeping the paragraphs short makes the sequence easier to follow on both desktop and mobile.`,
    `A useful review should separate confirmed experience from assumptions. For that reason, I stayed within the campaign brief, uploaded photos, and personal note.`,
    `Experiences can vary from person to person, so readers should consider these original photos and firsthand notes together.`,
    `Before publishing, I checked the requested length, terms, media count, links, and tags once more while keeping the writing readable.`,
  ];

  const keywordPhrases = language === "ko" ? [
    (term: string) => `${term} 찾고 계셨다면 여기 참고하시면 좋을 것 같아요!`,
    (term: string) => `${term} 다녀온 후기라 사진도 순서대로 올려둘게요~`,
    (term: string) => `이번에 ${term} 후기 쓰면서 사진 진짜 많이 찍었어요 ㅎㅎ`,
    (term: string) => `${term} 궁금하셨던 분들은 사진 같이 보시면 감 오실 거예요!`,
  ] : [
    (term: string) => `I organized these firsthand notes and photos for readers researching ${term}.`,
    (term: string) => `This ${term} record follows the actual experience and uploaded photo order.`,
    (term: string) => `Readers comparing ${term} information can use the confirmed details and original images together.`,
  ];
  const keywordSentences: string[] = [];
  for (const term of bodyKeywords) {
    const expected = minimumCounts[term] ?? requirements.keywordRules.minimumOccurrences ?? 1;
    let phraseIndex = 0;
    while (occurrences([...paragraphs, ...keywordSentences].join("\n\n"), term) < expected) {
      keywordSentences.push(keywordPhrases[phraseIndex % keywordPhrases.length](term));
      phraseIndex += 1;
    }
  }

  // Slot the keyword sentences between photo blocks. Stacking them all at the end is
  // what makes a draft read as machine-padded. Each photo occupies two entries
  // (marker + text), so insert only on pair boundaries to keep markers with their text.
  const photoStart = paragraphs.findIndex((line) => line.startsWith("[PHOTO:"));
  if (photoStart !== -1) {
    let inserted = 0;
    for (const [index, sentence] of keywordSentences.entries()) {
      const boundary = photoStart + (index + 1) * 2 + inserted;
      if (index + 1 >= media.length) {
        paragraphs.push(sentence);
        continue;
      }
      paragraphs.splice(boundary, 0, sentence);
      inserted += 1;
    }
  } else {
    paragraphs.push(...keywordSentences);
  }

  let draft = paragraphs.join("\n\n");
  for (const mention of requiredMentions) {
    if (!draft.includes(mention)) {
      draft += language === "ko" ? `\n\n공고에서 요청한 ${mention} 내용도 빠뜨리지 않고 함께 기록합니다.` : `\n\nThis record also includes the required mention: ${mention}.`;
    }
  }
  const targetLength = Math.max(minimumCharacters, 700);
  // Long campaigns (1,500자+) drain the closing pool and start repeating it, so the
  // uploaded captions become extra padding material that still refers to real photos.
  const recallPool = language === "ko"
    ? media
        .map((item) => item.caption?.trim())
        .filter((caption): caption is string => Boolean(caption) && !/^직접 업로드한/.test(caption!))
        .map((caption) => `다시 봐도 ${caption} 사진이 마음에 들어요! 이 장면은 꼭 담고 싶었거든요~`)
    : [];
  const fillerPool = [...closingPool, ...recallPool];
  const usedFiller = new Set<string>();
  // Stop once every filler line is spent rather than cycling the pool again. A draft
  // that repeats the same paragraph four times reads as spam; falling short instead
  // lets the rule checker flag the gap so the writer adds their own experience.
  while (characterCount(draft) < targetLength && usedFiller.size < fillerPool.length) {
    draft += `\n\n${pickUnused(fillerPool, usedFiller)}`;
  }
  // The sign-off is appended after the padding loop so it always lands last.
  if (language === "ko") {
    draft += `\n\n${pick([
      "그럼 다음에 또 좋은 곳 다녀와서 후기로 돌아올게요! 안녕~~",
      "그럼 다음에 또 맛있는 곳으로 돌아올게요! 안녕히 계세요~",
      "오늘 후기는 여기까지예요! 읽어주셔서 감사합니당 :)",
    ])}`;
  }
  if (requiredLinks.length) draft += `\n\n${requiredLinks.join("\n")}`;
  if (requiredHashtags.length) draft += `\n\n${requiredHashtags.join(" ")}`;

  return {
    title,
    applicationMessage: generateApplicationMessagesLocally(requirements, [], language).variants[0].message,
    blogDraft: draft,
    photoOrder: media.map((item, index) => ({
      fileName: item.fileName,
      category: item.category,
      reason: language === "ko" ? `${index + 1}번째 체험 흐름에 배치` : `Placed at step ${index + 1} of the experience story`,
    })),
    unverifiedClaims: [],
  };
}
