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

const leadingNoisePatterns = [
  /^(?:title|subject|제목|캠페인\s*명?|체험단\s*명?|공고\s*명?)\s*[:：]\s*/i,
  /^[[(（【<][^\])）】>]{0,40}[\])）】>]\s*/,
  /^[가-힣]{2,12}(?:맛집|카페|베이커리|미용|헤어|네일|피부|병원|숙박|여행|배달|체험단)\s*(?:체험단)?\s+(?=\S)/,
  /^(?:모집|신청|체험|리뷰)\s*[|｜/·]\s*/,
];

function cleanIdentityText(raw: string | undefined) {
  let value = (raw ?? "").replace(/\s+/g, " ").trim();
  for (let pass = 0; pass < 6; pass += 1) {
    const before = value;
    for (const pattern of leadingNoisePatterns) value = value.replace(pattern, "").trim();
    if (value === before) break;
  }
  return value.replace(/\s*[[【][^\]】]{0,40}[\]】]\s*$/, "").replace(/[\s·|｜/,.\-–—]+$/, "").trim();
}

function findCampaignIdentity(lines: string[]) {
  const first = cleanIdentityText(lines[0]);
  const explicitCampaign = cleanIdentityText(payloadAfterLabel(lines, /^(?:캠페인명|체험단명|공고명)\s*[:：]?/));
  const explicitBrand = cleanIdentityText(payloadAfterLabel(lines, /^(?:업체명|상호명|브랜드명?|매장명)\s*[:：]?/));
  const socialTitle = first.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  const brand = explicitBrand || cleanIdentityText(socialTitle?.[1]) || first;
  const campaignName = explicitCampaign || cleanIdentityText(socialTitle?.[2]) || first;
  return {
    campaignName: (campaignName || "Campaign name not identified").slice(0, 300),
    brand: (brand || "Brand not identified").slice(0, 200),
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

const koRoleHints = /(개발자|엔지니어|디자이너|마케터|기획자|직장인|회사원|프리랜서|사업자|대학생|학생|주부|자취생|블로거|인플루언서|사진작가|간호사|교사|승무원|커플|부부|가족|아빠|엄마|자매|남매|친구)/;
const koDeskRoleHints = /(개발자|엔지니어|디자이너|마케터|기획자|연구원)/;
const koInterestHints = /(좋아|즐기|사랑|관심|취미|탐방|덕후|마니아|매니아|찍|먹|다니|기록|쓰)/;
const enRoleHints = /\b(developer|engineer|designer|marketer|planner|researcher|student|freelancer|teacher|nurse|photographer|blogger|influencer|writer|couple|family|office\s*worker)\b/i;
const enDeskRoleHints = /\b(developer|engineer|designer|marketer|planner|researcher)\b/i;

function hasFinalConsonant(word: string) {
  const last = word.replace(/[)\]"'”’·\s]+$/u, "").slice(-1);
  if (!last) return false;
  const code = last.codePointAt(0) ?? 0;
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(last)) return /[013678]/.test(last);
  return /[lmnrLMNR]/.test(last);
}

function withParticle(word: string, afterConsonant: string, afterVowel: string) {
  return word ? `${word}${hasFinalConsonant(word) ? afterConsonant : afterVowel}` : "";
}

function withMeansParticle(word: string) {
  const last = word.replace(/[)\]"'”’·\s]+$/u, "").slice(-1);
  const code = last.codePointAt(0) ?? 0;
  const isHangul = code >= 0xac00 && code <= 0xd7a3;
  const finalIndex = isHangul ? (code - 0xac00) % 28 : -1;
  return `${word}${finalIndex === 0 || finalIndex === 8 || !isHangul ? "로" : "으로"}`;
}

function joinEn(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function joinKo(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  const head = items.slice(0, -1).join(", ");
  return `${withParticle(head, "과", "와")} ${items[items.length - 1]}`;
}

function stripInterestTail(raw: string) {
  return raw
    .replace(/^(?:저는|제가)\s*/, "")
    .replace(/\s*(?:을|를|이|가)?\s*(?:정말|너무|엄청|아주|많이)?\s*(?:좋아합니다|좋아해요|좋아함|좋아해|즐깁니다|즐겨요|즐김|사랑합니다|사랑해요|관심\s*(?:많음|있음|있어요|있습니다)|관심사)\s*$/, "")
    .trim();
}

function readApplicantProfile(keywords: string[]) {
  let age: string | null = null;
  let role: string | null = null;
  const interests: string[] = [];
  const extras: string[] = [];

  for (const keyword of keywords) {
    const ageMatch = keyword.match(/(\d{1,2})\s*(?:세|살)|\b(\d{1,2})\s*(?:years?\s*old|yo)\b/i);
    const withoutAge = ageMatch ? keyword.replace(ageMatch[0], "").trim() : keyword;
    if (ageMatch && !age) age = `${ageMatch[1] ?? ageMatch[2]}살`;
    if (!withoutAge) continue;
    if (!age && /^\d{2}$/.test(withoutAge)) {
      age = `${withoutAge}살`;
      continue;
    }
    if (!role && (koRoleHints.test(withoutAge) || enRoleHints.test(withoutAge)) && !/좋아|즐기|사랑|관심/.test(withoutAge)) {
      role = withoutAge;
      continue;
    }
    const trimmed = stripInterestTail(withoutAge);
    if (!trimmed) continue;
    if (koInterestHints.test(withoutAge)) interests.push(trimmed);
    else extras.push(trimmed);
  }

  return { age, role, interests: unique(interests).slice(0, 4), extras: unique(extras).slice(0, 3) };
}

function offerFocus(offer: string | undefined, language: Locale) {
  const text = offer ?? "";
  const hasDessert = /디저트|케이크|빵|베이커리|쿠키|마카롱|아이스크림/.test(text);
  const hasDrink = /음료|커피|라떼|차|주스|에이드|와인|맥주/.test(text);
  if (language !== "ko") {
    if (hasDessert && hasDrink) return "the desserts and drinks";
    if (hasDessert) return "the desserts";
    if (hasDrink) return "the drinks";
    if (/객실|숙박|호텔|펜션|스테이/.test(text)) return "the room and facilities";
    return "the dishes and plating";
  }
  if (hasDessert && hasDrink) return "디저트와 음료 사진";
  if (hasDessert) return "디저트 사진";
  if (hasDrink) return "음료 사진";
  if (/객실|숙박|호텔|펜션|스테이/.test(text)) return "객실과 편의시설 사진";
  if (/시술|케어|마사지|네일|헤어|피부/.test(text)) return "시술 과정과 결과 사진";
  return "메뉴와 음식 사진";
}

export function generateApplicationMessagesLocally(
  requirements: CampaignRequirements,
  applicantKeywords: string[] = [],
  language: Locale = "ko",
): { variants: ApplicationMessageVariant[]; businessHighlights: string[] } {
  const brand = /not identified/i.test(requirements.brand) ? "" : requirements.brand;
  const campaign = /not identified/i.test(requirements.campaignName) ? "" : requirements.campaignName;
  const place = brand || campaign || (language === "ko" ? "이번 체험단" : "this campaign");
  const offer = requirements.providedItems[0];
  const profile = readApplicantProfile(applicantKeywords);
  const focus = offerFocus(offer, language);
  const mission = [
    requirements.minimumPhotos ? (language === "ko" ? `사진 ${requirements.minimumPhotos}장` : `${requirements.minimumPhotos} photos`) : "",
    requirements.minimumCharacters ? (language === "ko" ? `본문 ${requirements.minimumCharacters.toLocaleString("ko-KR")}자` : `${requirements.minimumCharacters.toLocaleString("en-US")} characters`) : "",
    requirements.requiredKeywords.length ? (language === "ko" ? `필수 키워드 ${requirements.requiredKeywords.slice(0, 4).join(", ")}` : `the required keywords ${requirements.requiredKeywords.slice(0, 4).join(", ")}`) : "",
  ].filter(Boolean).join(", ");

  if (language === "ko") {
    const role = profile.role ?? "블로거";
    const introLead = profile.interests.length
      ? `${withParticle(joinKo(profile.interests), "을", "를")} 정말 좋아하는 `
      : "맛있는 곳을 찾아다니고 사진으로 기록하는 걸 정말 좋아하는 ";
    const details = ["매장 외관과 분위기", "메뉴 구성", focus, "맛과 식감", "추천 포인트"];
    const habit = koDeskRoleHints.test(role)
      ? `${withMeansParticle(role)} 일하다 보니 작은 부분까지 살펴보고 정리하는 습관이 있어서,`
      : "평소 작은 부분까지 살펴보고 정리하는 걸 좋아해서,";

    const opening = [
      `${introLead}${profile.age ? `${profile.age} ` : ""}${role}입니다.`,
      "평소에도 마음에 드는 곳을 찾아다니며 음식뿐만 아니라 매장 분위기와 메뉴까지 사진으로 꼼꼼하게 기록하는 걸 좋아해요.",
      profile.extras.length ? `${joinKo(profile.extras)}라는 점도 이번 체험을 즐기기에 잘 맞는다고 생각합니다.` : "",
      offer ? `공고에서 안내해주신 ${offer}${brand ? `을 보고 ${brand}의 분위기가 더 궁금해졌어요.` : "을 보고 더 방문해보고 싶어졌어요."}` : `${place}의 분위기와 메뉴가 궁금해서 이번 공고를 눈여겨보게 되었어요.`,
      `블로그를 꾸준히 키워가고 있어서, 선정된다면 단순한 체험 후기가 아니라 ${details.join(", ")}까지 직접 느낀 내용을 자세하고 정성스럽게 담아보겠습니다.`,
    ].filter(Boolean).join(" ");

    const closing = [
      `${habit} 리뷰도 대충 쓰기보다는 검색해서 들어온 분들이 실제 방문을 결정하는 데 도움이 될 수 있도록 사진도 다양한 구도로 많이 찍고 글도 꼼꼼하게 작성하는 편입니다.`,
      "방문 전에는 공고의 일정과 주의사항을 다시 확인하고 약속된 절차를 성실하게 지키겠습니다.",
      mission ? `${mission} 등 공고에 적힌 작성 조건도 빠짐없이 확인해서 반영하겠습니다.` : "",
      "과장된 표현이나 경험하지 않은 내용은 더하지 않고, 제가 실제로 보고 느낀 점만 솔직하게 담겠습니다.",
      `아직 성장 중인 블로그인 만큼 포스팅 하나하나에 더 애정을 쏟고 있고, 선정해주신다면 ${place}의 매력이 잘 전달될 수 있도록 정성스러운 후기 남기겠습니다.`,
    ].filter(Boolean).join(" ");

    return {
      variants: [{ label: "맞춤 신청 문구", message: `${opening}\n\n${closing}` }],
      businessHighlights: unique([offer, ...requirements.otherRequirements]).slice(0, 3),
    };
  }

  const role = profile.role ?? "blogger";
  const interests = joinEn(profile.interests) || "finding good places and photographing them";
  const details = joinEn(["the exterior and atmosphere", "the menu line-up", focus, "the taste and texture", "who I would recommend it to"]);
  const opening = [
    `I am a ${profile.age ? `${profile.age.replace("살", "")}-year-old ` : ""}${role} who genuinely loves ${interests}.`,
    "Whenever I visit somewhere I like, I photograph not only the food but also the space and the menu in detail.",
    profile.extras.length ? `I am also ${joinEn(profile.extras)}, which I think fits this experience well.` : "",
    offer ? `The listed offer, ${offer}, made me even more curious about ${place}.` : `I have been curious about ${place} for a while.`,
    `I am steadily growing my blog, so if I am selected I will cover ${details} in a detailed, carefully written post rather than a throwaway review.`,
  ].filter(Boolean).join(" ");

  const closing = [
    `${enDeskRoleHints.test(role) ? `Working as a ${role} has given me a habit of noticing and organizing small details` : "I have a habit of noticing and organizing small details"}, so I take photos from a range of angles and write thoroughly enough to help readers who arrive from search decide whether to visit.`,
    "Before visiting I will recheck the schedule and every instruction in the brief and follow the agreed process carefully.",
    mission ? `I will also verify ${mission} before publishing.` : "",
    "I will not exaggerate or add anything I did not experience — only what I genuinely see and feel.",
    `My blog is still growing, so I put real care into each post, and if selected I will write a thoughtful review that shows what makes ${place} worth visiting.`,
  ].filter(Boolean).join(" ");

  return {
    variants: [{ label: "Recommended message", message: `${opening}\n\n${closing}` }],
    businessHighlights: unique([offer, ...requirements.otherRequirements]).slice(0, 3),
  };
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
  const paragraphs = language === "ko" ? [
    `${campaign} 체험을 마친 뒤, 직접 촬영한 사진과 그때 남긴 메모를 순서대로 정리해 보았어요. 확인하지 못한 정보는 임의로 덧붙이지 않고 제가 실제로 경험한 내용만 담았습니다.`,
    `${note ? `제가 체험 직후 남긴 솔직한 메모는 “${note}”였어요.` : "별도의 체험 메모가 없어 사진으로 확인할 수 있는 흐름만 정리했어요."} 기억에 의존해 내용을 과장하기보다 이 기록을 중심으로 후기를 구성했습니다.`,
    `${offer ? `공고에 안내된 제공 내역은 ${offer}이었고, 실제 후기도 이 체험의 흐름이 잘 드러나도록 정리했어요.` : "공고에 적힌 체험 내용과 제가 남긴 기록이 어긋나지 않도록 하나씩 확인하며 글을 작성했어요."}`,
    `처음 보는 분도 체험 과정을 쉽게 따라올 수 있도록 사진을 시간 순서에 가깝게 배치했어요. 각 장면 사이에는 제가 직접 확인한 내용만 연결해 불필요한 추측을 줄였습니다.`,
  ] : [
    `After completing ${campaign}, I organized my original photos and firsthand notes in a clear sequence. I have included only what I actually experienced and have not filled any gaps with guesses.`,
    `${note ? `My note immediately after the visit was: “${note}”` : "No separate visit note was provided, so this draft follows only the uploaded photo sequence."} I kept that evidence at the center of the story instead of exaggerating the experience.`,
    `${offer ? `The campaign listed ${offer}, and I organized the post around that experience.` : "I cross-checked the campaign brief while organizing this review."} The aim is to make the visit easy for a reader to follow.`,
    `I placed the photos in a simple narrative order and connected them only with observations supported by my note. This keeps the review useful without adding unverified details.`,
  ];

  media.forEach((item, index) => {
    paragraphs.push(`[PHOTO: ${item.fileName} — ${item.caption ?? item.category}]`);
    paragraphs.push(language === "ko"
      ? `직접 업로드한 ${index + 1}번째 사진입니다. 이 장면은 체험 기록의 흐름을 보여주기 위해 배치했으며, 사진과 메모로 확인할 수 없는 정보는 따로 단정하지 않았어요.`
      : `This is uploaded photo ${index + 1}. I placed it here to continue the visit story and avoided claims about taste or service that the image and note cannot support.`);
  });

  const closingPool = language === "ko" ? [
    `글을 정리하면서 가장 중요하게 생각한 점은 실제 방문자의 시선이 자연스럽게 전달되는 것이었어요. 광고 문구처럼 과장하기보다 어떤 순서로 체험했고 무엇을 기억했는지 편안하게 읽히도록 구성했습니다.`,
    `사진마다 같은 설명을 반복하지 않고 전체 모습과 세부 장면이 서로 이어지도록 배치했어요. 덕분에 한 장만 볼 때보다 현장의 흐름을 조금 더 구체적으로 살펴볼 수 있습니다.`,
    `체험을 고민하는 분에게 필요한 것은 화려한 표현보다 확인 가능한 기록이라고 생각해요. 그래서 공고 내용, 직접 촬영한 사진, 개인 메모의 범위를 벗어나는 정보는 넣지 않았습니다.`,
    `${brand ? `${brand}에 대한 ` : "이번 "}후기는 제 실제 경험을 바탕으로 작성했어요. 같은 장소나 서비스를 경험하더라도 느낌은 다를 수 있으니 사진과 메모를 함께 참고해 주세요.`,
    `마지막으로 게시하기 전에는 공고에 적힌 키워드와 분량, 사진 수, 링크와 태그를 다시 확인했어요. 형식만 맞추는 데 그치지 않고 읽는 흐름도 자연스럽게 유지하려고 했습니다.`,
    `모바일에서도 부담 없이 읽을 수 있도록 문단을 짧게 나누고 사진 사이에 필요한 설명을 배치했어요. 실제 체험의 순서와 감상이 끊기지 않도록 차분하게 마무리했습니다.`,
  ] : [
    `My priority was to preserve a genuine visitor's point of view. I focused on what happened in sequence and what I recorded, rather than filling the post with promotional claims.`,
    `Each photo contributes a different moment to the story. Keeping the paragraphs short makes the sequence easier to follow on both desktop and mobile.`,
    `A useful review should separate confirmed experience from assumptions. For that reason, I stayed within the campaign brief, uploaded photos, and personal note.`,
    `Experiences can vary from person to person, so readers should consider these original photos and firsthand notes together.`,
    `Before publishing, I checked the requested length, terms, media count, links, and tags once more while keeping the writing readable.`,
  ];

  let draft = paragraphs.join("\n\n");
  const keywordPhrases = language === "ko" ? [
    (term: string) => `필수 키워드 “${term}”를 찾는 분들이 체험 흐름을 이해할 수 있도록 사진과 메모를 중심으로 정리했어요.`,
    (term: string) => `${term} 관련 정보를 살펴보는 분에게 도움이 되도록 직접 확인한 내용과 사진의 순서를 맞췄습니다.`,
    (term: string) => `이번 ${term} 기록은 과장된 설명보다 실제 체험에서 남은 인상과 촬영한 장면을 차분하게 전하는 데 집중했어요.`,
  ] : [
    (term: string) => `I organized these firsthand notes and photos for readers researching ${term}.`,
    (term: string) => `This ${term} record follows the actual experience and uploaded photo order.`,
    (term: string) => `Readers comparing ${term} information can use the confirmed details and original images together.`,
  ];
  for (const term of bodyKeywords) {
    const expected = minimumCounts[term] ?? requirements.keywordRules.minimumOccurrences ?? 1;
    let phraseIndex = 0;
    while (occurrences(draft, term) < expected) {
      draft += `\n\n${keywordPhrases[phraseIndex % keywordPhrases.length](term)}`;
      phraseIndex += 1;
    }
  }
  for (const mention of requiredMentions) {
    if (!draft.includes(mention)) {
      draft += language === "ko" ? `\n\n공고에서 요청한 ${mention} 내용도 빠뜨리지 않고 함께 기록합니다.` : `\n\nThis record also includes the required mention: ${mention}.`;
    }
  }
  const targetLength = Math.max(minimumCharacters, 700);
  let fillerIndex = 0;
  while (characterCount(draft) < targetLength) {
    draft += `\n\n${closingPool[fillerIndex % closingPool.length]}`;
    fillerIndex += 1;
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
