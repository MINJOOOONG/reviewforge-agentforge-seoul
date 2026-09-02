"use client";

import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  ImageIcon,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { UploadedMedia } from "@/components/MediaUploader";
import type { CampaignAnalysisResult, CampaignRequirements } from "@/types/campaign";
import type { ComplianceCheck, ComplianceResult, ComplianceStatus } from "@/types/compliance";
import type { GenerationResult } from "@/types/generation";
import type { MediaAnalysis, MediaAnalysisResult } from "@/types/media";
import type { Locale } from "@/types/locale";

const categoryLabels: Record<string, string> = {
  hero: "Hero",
  food: "Food",
  menu: "Menu",
  exterior: "Exterior",
  interior: "Interior",
  product: "Product",
  before: "Before",
  after: "After",
  atmosphere: "Atmosphere",
  other: "Other",
};

function CopyButton({ value, compact = false, locale = "en" }: { value: string; compact?: boolean; locale?: Locale }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`copy-button ${compact ? "is-compact" : ""}`}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1_600);
      }}
    >
      {copied ? <ClipboardCheck size={15} /> : <Clipboard size={15} />}
      {copied ? (locale === "ko" ? "복사됨" : "Copied") : (locale === "ko" ? "복사" : "Copy")}
    </button>
  );
}

function ResultHeading({ index, label, title, aside }: { index: string; label: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="result-heading">
      <div>
        <span>{index} / {label}</span>
        <h2>{title}</h2>
      </div>
      {aside}
    </div>
  );
}

function NoteLine({
  label,
  values,
  locale,
  empty,
  accent = false,
}: {
  label: string;
  values: string[];
  locale: Locale;
  empty?: string;
  accent?: boolean;
}) {
  return (
    <div className={`note-line ${accent ? "is-accent" : ""}`}>
      <span>{label}</span>
      <p>{values.length ? values.join(" · ") : (empty || (locale === "ko" ? "공고에 별도 안내 없음" : "Not specified"))}</p>
    </div>
  );
}

export function ExecutionReceipt({
  campaign,
  media,
  generation,
  compliance,
  locale,
}: {
  campaign: CampaignAnalysisResult | null;
  media: MediaAnalysisResult | null;
  generation: GenerationResult | null;
  compliance: ComplianceResult | null;
  locale: Locale;
}) {
  const receipts = [
    campaign && {
      provider: campaign.source.provider,
      action: "Public page reader",
      mode: campaign.source.mode,
      detail: campaign.source.requestId ? `Request ${campaign.source.requestId.slice(0, 18)}` : "Campaign source captured",
    },
    media && {
      provider: media.source.provider,
      action: "Photo ordering",
      mode: media.source.mode,
      detail: media.source.workloadId ? `Job ${media.source.workloadId.slice(0, 18)}` : media.source.model || "Media classified",
    },
    generation && {
      provider: generation.source.provider,
      action: generation.source.model,
      mode: generation.source.mode,
      detail: generation.source.requestId ? `Request ${generation.source.requestId.slice(0, 18)}` : "Grounded draft generated",
    },
    compliance && {
      provider: compliance.source.provider,
      action: "Deterministic checks",
      mode: compliance.source.mode,
      detail: compliance.source.sandboxId ? `Sandbox ${compliance.source.sandboxId.slice(0, 18)}` : "Verifier executed",
    },
  ].filter(Boolean) as Array<{
    provider: string;
    action: string;
    mode: "real" | "demo" | "local";
    detail: string;
  }>;

  if (!receipts.length) return null;
  return (
    <section className="execution-receipt" aria-label={locale === "ko" ? "처리 단계" : "Processing steps"}>
      <div className="receipt-heading"><span>{locale === "ko" ? "처리 단계" : "PROCESSING STEPS"}</span><small>{locale === "ko" ? "입력 데이터는 결과 생성 후 저장하지 않음" : "Inputs are not stored after generation"}</small></div>
      <div className="receipt-grid">
        {receipts.map((receipt, index) => (
          <div className="receipt-item" key={`${receipt.provider}-${receipt.action}-${index}`}>
            <i className={receipt.mode === "real" ? "is-real" : receipt.mode === "local" ? "is-local" : "is-demo"} />
            <div><strong>{receipt.provider}</strong><span>{receipt.action}</span></div>
            <small>{receipt.detail}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RequirementsCard({
  requirements,
  sourceProvider,
  locale,
}: {
  requirements: CampaignRequirements;
  sourceProvider: CampaignAnalysisResult["source"]["provider"];
  locale: Locale;
}) {
  const ko = locale === "ko";
  const review = requirements.reviewRequirements;
  const keywordRules = requirements.keywordRules;
  const minimumPhotos = review.minimumPhotos ?? requirements.minimumPhotos;
  const minimumVideos = review.minimumVideos ?? (requirements.videoRequired ? 1 : 0);
  const minimumCharacters = review.minimumCharacters ?? requirements.minimumCharacters;
  const requiredHashtags = Array.from(new Set([...review.requiredHashtags, ...requirements.requiredHashtags]));
  const visit = requirements.visitConditions;
  const visitSummary = [
    visit.basePartySize ? (ko ? `기준 ${visit.basePartySize}인` : `Party of ${visit.basePartySize}`) : null,
    visit.maxPartySize ? (ko ? `최대 ${visit.maxPartySize}인` : `Up to ${visit.maxPartySize} guests`) : null,
    visit.reservationRequired === true ? (ko ? "사전 예약 필수" : "Advance reservation required") : null,
    visit.petAllowed === true ? (ko ? "반려동물 동반 가능" : "Pets allowed") : null,
    ...visit.availableTimes,
    visit.parkingConditions,
    ...visit.companionConditions,
    ...visit.otherConditions,
  ].filter(Boolean) as string[];
  const keywordSummary = [
    ...(keywordRules.titleKeywords.length ? [ko ? `제목: ${keywordRules.titleKeywords.join(", ")}` : `Title: ${keywordRules.titleKeywords.join(", ")}`] : []),
    ...keywordRules.bodyKeywords.map((keyword) => {
      const count = review.minimumKeywordCounts[keyword] ?? requirements.minimumKeywordCounts[keyword] ?? keywordRules.minimumOccurrences ?? 1;
      return ko ? `본문: ${keyword} ${count}회 이상` : `Body: ${keyword} ${count}+ times`;
    }),
    ...keywordRules.requiredKeywords
      .filter((keyword) => !keywordRules.bodyKeywords.includes(keyword) && !keywordRules.titleKeywords.includes(keyword))
      .map((keyword) => ko ? `${keyword} 필수` : `${keyword} required`),
  ];
  const reviewSummary = Array.from(new Set([
    minimumPhotos > 0 ? (ko ? `사진 ${minimumPhotos}장 이상` : `${minimumPhotos}+ photos`) : null,
    minimumVideos > 0 ? (ko ? `영상 ${minimumVideos}개 이상` : `${minimumVideos}+ videos`) : null,
    minimumCharacters > 0 ? (ko ? `본문 ${minimumCharacters.toLocaleString("ko-KR")}자 이상` : `${minimumCharacters.toLocaleString("en-US")}+ characters`) : null,
    review.mapLinkRequired ? (ko ? "지도 위치 링크 필수" : "Map location link required") : null,
    ...requirements.requiredMentions,
    ...review.requiredLinks,
    ...requirements.requiredLinks.filter((link) => !review.requiredLinks.includes(link)),
    ...review.otherRequiredMissions,
    ...requirements.otherRequirements,
  ].filter(Boolean) as string[]));

  return (
    <section className="result-card requirements-card requirements-note-card">
      <ResultHeading
        index="01"
        label={sourceProvider === "Demo Fixture" ? "DEMO FIXTURE" : "WEB READER + LOCAL ENGINE"}
        title={ko ? "캠페인 요구사항" : "Campaign requirements"}
        aside={<span className="evidence-badge"><Check size={13} /> {ko ? "공개 공고 수집 완료" : "Public source captured"}</span>}
      />
      <div className="requirements-note">
        <div className="note-heading">
          <div><span>CAMPAIGN NOTE</span><strong>{requirements.campaignName}</strong><small>{requirements.brand}</small></div>
          <p><CalendarDays size={14} /> {ko ? "마감" : "Deadline"} · {requirements.deadline || (ko ? "미확인" : "Not specified")}</p>
        </div>
        <NoteLine label={ko ? "제공 내역" : "WHAT YOU RECEIVE"} values={requirements.providedItems} locale={locale} />
        <NoteLine label={ko ? "모집 조건" : "WHO CAN APPLY"} values={requirements.recruitmentConditions} locale={locale} />
        <NoteLine label={ko ? "방문 조건" : "VISIT CONDITIONS"} values={visitSummary} locale={locale} />
        <NoteLine label={ko ? "필수 키워드" : "REQUIRED KEYWORDS"} values={keywordSummary} locale={locale} />
        <NoteLine label={ko ? "리뷰 미션" : "REVIEW MISSION"} values={reviewSummary} locale={locale} />
        <NoteLine label={ko ? "필수 태그" : "REQUIRED TAGS"} values={requiredHashtags} locale={locale} empty={ko ? "필수 태그 없음" : "No required tags"} accent />
        {requirements.selectionBoosters.length > 0 && <NoteLine label={ko ? "선정 팁" : "SELECTION TIPS"} values={requirements.selectionBoosters.map((item) => item.description)} locale={locale} />}
        {requirements.conditionalRequirements.length > 0 && <NoteLine label={ko ? "조건부 안내" : "CONDITIONAL"} values={requirements.conditionalRequirements.map((item) => item.requirement)} locale={locale} />}
      </div>
    </section>
  );
}

export function MediaAndOrder({
  media,
  generation,
  uploads,
  locale,
}: {
  media: MediaAnalysis[];
  generation: GenerationResult | null;
  uploads: UploadedMedia[];
  locale: Locale;
}) {
  const previewMap = useMemo(() => new Map(uploads.map((item) => [item.file.name, item.preview])), [uploads]);

  return (
    <section className="result-card media-card">
      <ResultHeading
        index="02"
        label="PHOTO ORGANIZER + LOCAL WRITER"
        title={locale === "ko" ? "미디어 분석" : "Media intelligence"}
        aside={<span className="evidence-badge is-purple"><Sparkles size={13} /> {locale === "ko" ? "사진 정리 완료" : "Photos ordered"}</span>}
      />
      <div className="media-strip">
        {media.map((item, index) => (
          <article className="media-tile" key={`${item.fileName}-${index}`}>
            <div className="media-image">
              {previewMap.get(item.fileName) ? (
                // Blob URLs are local previews.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewMap.get(item.fileName)} alt={item.caption || item.fileName} />
              ) : <ImageIcon size={28} />}
              <span>{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div className="media-meta">
              <strong>{categoryLabels[item.category] || item.category}</strong>
              <small title={item.fileName}>{item.fileName}</small>
              <div className="quality-meter">
                <i style={{ width: `${Math.round(item.qualityScore * 100)}%` }} />
              </div>
              <p><span>QUALITY</span>{Math.round(item.qualityScore * 100)}%</p>
            </div>
          </article>
        ))}
      </div>

      {generation && (
        <div className="photo-order-block">
          <span className="subsection-label">{locale === "ko" ? "추천 사진 순서" : "RECOMMENDED STORY ORDER"}</span>
          <div className="photo-order-list">
            {generation.photoOrder.map((item, index) => (
              <div className="order-item" key={`${item.fileName}-${index}`}>
                <span className="order-number">{String(index + 1).padStart(2, "0")}</span>
                <div className="order-thumb">
                  {previewMap.get(item.fileName) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewMap.get(item.fileName)} alt="" />
                  ) : <ImageIcon size={17} />}
                </div>
                <div><strong>{categoryLabels[item.category] || item.category}</strong><small>{item.fileName}</small></div>
                <p>{item.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function GeneratedContent({
  generation,
  uploads,
  requirements,
  compliance,
  locale,
}: {
  generation: GenerationResult;
  uploads: UploadedMedia[];
  requirements: CampaignRequirements;
  compliance: ComplianceResult | null;
  locale: Locale;
}) {
  const ko = locale === "ko";
  const previewMap = useMemo(() => new Map(uploads.map((item) => [item.file.name, item.preview])), [uploads]);
  const uploadedFileNames = useMemo(
    () => Array.from(previewMap.keys()).sort((left, right) => right.length - left.length),
    [previewMap],
  );

  const parsePhotoMarker = (line: string) => {
    const marker = line.trim().match(/^\[PHOTO:\s*(.+?)\s*\]$/);
    if (!marker) return null;

    const markerBody = marker[1].trim();
    const uploadedFileName = uploadedFileNames.find((fileName) => (
      markerBody === fileName
      || markerBody.startsWith(`${fileName} —`)
      || markerBody.startsWith(`${fileName} –`)
      || markerBody.startsWith(`${fileName} -`)
    ));

    if (uploadedFileName) {
      return {
        fileName: uploadedFileName,
        description: markerBody
          .slice(uploadedFileName.length)
          .replace(/^\s*[—–-]\s*/, "")
          .trim(),
      };
    }

    const fallback = markerBody.match(/^(.*?)\s+[—–-]\s+(.+)$/);
    return fallback
      ? { fileName: fallback[1].trim(), description: fallback[2].trim() }
      : { fileName: markerBody, description: "" };
  };

  const review = requirements.reviewRequirements;
  const keywordRules = requirements.keywordRules;
  const minimumCharacters = review.minimumCharacters ?? requirements.minimumCharacters;
  const minimumPhotos = review.minimumPhotos ?? requirements.minimumPhotos;
  const minimumVideos = review.minimumVideos ?? (requirements.videoRequired ? 1 : 0);
  const bodyWithoutPhotoMarkers = generation.blogDraft.replace(/^\s*\[PHOTO:.*\]\s*$/gm, "");
  const actualCharacters = Array.from(bodyWithoutPhotoMarkers.replace(/\s/g, "")).length;
  const placedPhotos = new Set(
    generation.blogDraft
      .split("\n")
      .map(parsePhotoMarker)
      .filter((marker): marker is { fileName: string; description: string } => Boolean(marker && previewMap.has(marker.fileName)))
      .map((marker) => marker.fileName),
  ).size;
  const minimumKeywordCounts = { ...review.minimumKeywordCounts, ...requirements.minimumKeywordCounts };
  const bodyKeywords = Array.from(new Set([...keywordRules.requiredKeywords, ...requirements.requiredKeywords, ...keywordRules.bodyKeywords]));
  const keywordChecks = [
    ...keywordRules.titleKeywords.map((keyword) => generation.title.includes(keyword)),
    ...bodyKeywords.map((keyword) => {
      const required = minimumKeywordCounts[keyword] ?? keywordRules.minimumOccurrences ?? 1;
      return generation.blogDraft.split(keyword).length - 1 >= required;
    }),
  ];
  const requiredHashtags = Array.from(new Set([...review.requiredHashtags, ...requirements.requiredHashtags]));
  const includedHashtags = requiredHashtags.filter((hashtag) => generation.blogDraft.includes(hashtag)).length;
  const requiredLinks = Array.from(new Set([...review.requiredLinks, ...requirements.requiredLinks]));
  const includedLinks = requiredLinks.filter((link) => generation.blogDraft.includes(link)).length;
  const mapLinkIncluded = !review.mapLinkRequired || /(map\.naver\.com|place\.map\.kakao\.com|maps\.app\.goo\.gl|google\.[^/\s]+\/maps)/i.test(generation.blogDraft);
  const checks = [
    {
      label: ko ? "글자 수" : "Characters",
      value: minimumCharacters > 0
        ? `${actualCharacters.toLocaleString(locale === "ko" ? "ko-KR" : "en-US")} / ${minimumCharacters.toLocaleString(locale === "ko" ? "ko-KR" : "en-US")}`
        : `${actualCharacters.toLocaleString(locale === "ko" ? "ko-KR" : "en-US")}`,
      passed: minimumCharacters <= 0 || actualCharacters >= minimumCharacters,
    },
    {
      label: ko ? "본문 사진" : "Placed photos",
      value: minimumPhotos > 0 ? `${placedPhotos} / ${minimumPhotos}` : `${placedPhotos}`,
      passed: minimumPhotos <= 0 || placedPhotos >= minimumPhotos,
    },
    ...(minimumVideos > 0 ? [{ label: ko ? "영상" : "Videos", value: `0 / ${minimumVideos}`, passed: false }] : []),
    {
      label: ko ? "필수 키워드" : "Keywords",
      value: `${keywordChecks.filter(Boolean).length} / ${keywordChecks.length}`,
      passed: keywordChecks.every(Boolean),
    },
    {
      label: ko ? "필수 태그" : "Hashtags",
      value: `${includedHashtags} / ${requiredHashtags.length}`,
      passed: includedHashtags === requiredHashtags.length,
    },
    ...(requiredLinks.length > 0 || review.mapLinkRequired ? [{
      label: ko ? "필수 링크" : "Required links",
      value: `${includedLinks + (review.mapLinkRequired && mapLinkIncluded && !requiredLinks.some((link) => /map\./i.test(link)) ? 1 : 0)} / ${requiredLinks.length + (review.mapLinkRequired && !requiredLinks.some((link) => /map\./i.test(link)) ? 1 : 0)}`,
      passed: includedLinks === requiredLinks.length && mapLinkIncluded,
    }] : []),
  ];
  const allRequirementsPassed = compliance ? compliance.summary.fail === 0 : checks.every((check) => check.passed);

  return (
    <section className="generated-layout">
      <article className="result-card draft-card">
        <ResultHeading index="02" label={generation.source.provider.toUpperCase()} title={locale === "ko" ? "블로그 초안" : "Blog draft"} aside={<CopyButton value={`${generation.title}\n\n${generation.blogDraft}`} locale={locale} />} />
        <div className="draft-title-block">
          <span>{locale === "ko" ? "생성된 제목" : "GENERATED TITLE"}</span>
          <h3>{generation.title}</h3>
        </div>
        <div className={`draft-verification ${allRequirementsPassed ? "is-pass" : "is-warning"}`}>
          <div className="draft-verification-heading">
            <span>{compliance ? (ko ? "LOCAL ENGINE · 작성 기준 확인" : "LOCAL ENGINE · REQUIREMENTS CHECKED") : (ko ? "작성 기준 확인" : "REQUIREMENT CHECK")}</span>
            <strong>{allRequirementsPassed ? (ko ? "공고 기준을 충족했어요" : "Campaign requirements met") : (ko ? "보완이 필요한 항목이 있어요" : "Some requirements need attention")}</strong>
            {compliance && <small>{ko ? `준비도 ${compliance.score} / 100 · 실패 ${compliance.summary.fail}개` : `Readiness ${compliance.score} / 100 · ${compliance.summary.fail} failed`}</small>}
          </div>
          <div className="draft-check-list">
            {checks.map((check) => (
              <div className={`draft-check ${check.passed ? "is-pass" : "is-fail"}`} key={check.label}>
                {check.passed ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <span>{check.label}</span>
                <strong>{check.value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="draft-paper">
          {generation.blogDraft.split("\n").map((line, index) => {
            const photoMarker = parsePhotoMarker(line);
            if (photoMarker) {
              const { fileName, description } = photoMarker;
              return (
                <figure className="draft-photo" key={`${fileName}-${index}`}>
                  {previewMap.get(fileName) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewMap.get(fileName)} alt={description} />
                  ) : <div className="draft-photo-placeholder"><ImageIcon size={30} /></div>}
                  <figcaption><span>PHOTO</span><strong>{fileName}</strong><small>{description}</small></figcaption>
                </figure>
              );
            }
            if (!line.trim()) return <div className="draft-spacer" key={index} />;
            return <p key={index}>{line}</p>;
          })}
        </div>
      </article>
    </section>
  );
}

function CheckIcon({ status }: { status: ComplianceStatus }) {
  if (status === "PASS") return <CheckCircle2 size={18} />;
  if (status === "WARNING") return <AlertTriangle size={18} />;
  if (status === "OPTIONAL" || status === "NA") return <MessageCircleMore size={18} />;
  return <XCircle size={18} />;
}

function CheckGroup({ status, checks }: { status: ComplianceStatus; checks: ComplianceCheck[] }) {
  const filtered = checks.filter((check) => check.status === status);
  if (!filtered.length) return null;
  return (
    <div className={`qa-group qa-${status.toLowerCase()}`}>
      <span>{status === "NA" ? "N/A" : status}</span>
      {filtered.map((check, index) => (
        <div className="qa-check" key={`${check.name}-${index}`}>
          <CheckIcon status={status} />
          <strong>{check.name}</strong>
          <small>{check.detail}</small>
        </div>
      ))}
    </div>
  );
}

export function ComplianceCard({ result, locale }: { result: ComplianceResult; locale: Locale }) {
  return (
    <section className="result-card compliance-card">
      <ResultHeading
        index="04"
        label="LOCAL RULE CHECKER"
        title={locale === "ko" ? "미션 검수" : "Deterministic compliance"}
        aside={<span className="evidence-badge is-dark"><ShieldCheck size={13} /> {locale === "ko" ? "조건 확인 완료" : "Requirements checked"}</span>}
      />
      <div className="compliance-layout">
        <div className="score-panel">
          <div className="score-ring" style={{ "--score": `${result.score * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{result.score}</strong><span>/ 100</span></div>
          </div>
          <span>{locale === "ko" ? "캠페인 준비도" : "CAMPAIGN READINESS"}</span>
          <h3>{result.summary.fail === 0 ? (locale === "ko" ? "발행 준비 완료" : "Ready to publish") : (locale === "ko" ? "확인이 필요한 미션이 있습니다" : "A few missions need attention")}</h3>
          <p>{locale === "ko" ? `통과 ${result.summary.pass} · 경고 ${result.summary.warning} · 실패 ${result.summary.fail}` : `${result.summary.pass} passed · ${result.summary.warning} warnings · ${result.summary.fail} failed`}</p>
          {result.source.sandboxId && <small>Sandbox {result.source.sandboxId.slice(0, 12)}</small>}
        </div>
        <div className="qa-list">
          <CheckGroup status="PASS" checks={result.checks} />
          <CheckGroup status="WARNING" checks={result.checks} />
          <CheckGroup status="FAIL" checks={result.checks} />
          <CheckGroup status="OPTIONAL" checks={result.checks} />
          <CheckGroup status="NA" checks={result.checks} />
        </div>
      </div>
    </section>
  );
}
