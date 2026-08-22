"use client";

import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  ExternalLink,
  Hash,
  ImageIcon,
  Link2,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
  Type,
  Video,
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
      provider: "Bright Data",
      action: "Web Unlocker",
      mode: campaign.source.mode,
      detail: campaign.source.requestId ? `Request ${campaign.source.requestId.slice(0, 18)}` : "Campaign source captured",
    },
    media && {
      provider: "Nosana",
      action: "CUDA · CLIP",
      mode: media.source.mode,
      detail: media.source.workloadId ? `Job ${media.source.workloadId.slice(0, 18)}` : media.source.model || "Media classified",
      href:
        media.source.mode === "real" && media.source.workloadId
          ? `https://explore.nosana.com/jobs/${media.source.workloadId}`
          : undefined,
    },
    generation && {
      provider: "Qwen Cloud",
      action: generation.source.model,
      mode: generation.source.mode,
      detail: generation.source.requestId ? `Request ${generation.source.requestId.slice(0, 18)}` : "Grounded draft generated",
    },
    compliance && {
      provider: "Daytona",
      action: "TypeScript sandbox",
      mode: compliance.source.mode,
      detail: compliance.source.sandboxId ? `Sandbox ${compliance.source.sandboxId.slice(0, 18)}` : "Verifier executed",
    },
  ].filter(Boolean) as Array<{
    provider: string;
    action: string;
    mode: "real" | "demo";
    detail: string;
    href?: string;
  }>;

  if (!receipts.length) return null;
  return (
    <section className="execution-receipt" aria-label={locale === "ko" ? "Provider 실행 증빙" : "Provider execution receipt"}>
      <div className="receipt-heading"><span>{locale === "ko" ? "실행 증빙" : "EXECUTION RECEIPT"}</span><small>{locale === "ko" ? "ID는 일부만 표시 · Secret은 서버 밖으로 전송되지 않음" : "IDs are truncated · secrets never leave the server"}</small></div>
      <div className="receipt-grid">
        {receipts.map((receipt) => (
          <div className="receipt-item" key={receipt.provider}>
            <i className={receipt.mode === "real" ? "is-real" : "is-demo"} />
            <div><strong>{receipt.provider}</strong><span>{receipt.action}</span></div>
            {receipt.href ? (
              <a href={receipt.href} target="_blank" rel="noreferrer">{receipt.detail}<ExternalLink size={11} /></a>
            ) : <small>{receipt.detail}</small>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function RequirementsCard({ requirements, locale }: { requirements: CampaignRequirements; locale: Locale }) {
  const ko = locale === "ko";
  const review = requirements.reviewRequirements;
  const keywordRules = requirements.keywordRules;
  const minimumPhotos = review.minimumPhotos ?? requirements.minimumPhotos;
  const minimumVideos = review.minimumVideos ?? (requirements.videoRequired ? 1 : 0);
  const minimumCharacters = review.minimumCharacters ?? requirements.minimumCharacters;
  const requirementRows = [
    ...keywordRules.requiredKeywords.map((keyword) => ({
      icon: Hash,
      label: keyword,
      detail: `${review.minimumKeywordCounts[keyword] ?? requirements.minimumKeywordCounts[keyword] ?? keywordRules.minimumOccurrences ?? 1}${ko ? "회 이상" : "+ uses"}`,
    })),
    ...keywordRules.titleKeywords.map((keyword) => ({ icon: Hash, label: `${ko ? "제목" : "Title"} · ${keyword}`, detail: ko ? "제목에 포함" : "Include in title" })),
    ...keywordRules.bodyKeywords.map((keyword) => ({ icon: Hash, label: `${ko ? "본문" : "Body"} · ${keyword}`, detail: `${review.minimumKeywordCounts[keyword] ?? requirements.minimumKeywordCounts[keyword] ?? keywordRules.minimumOccurrences ?? 1}${ko ? "회 이상" : "+ uses"}` })),
    ...(minimumPhotos > 0 ? [{ icon: ImageIcon, label: ko ? "필수 사진" : "Required photos", detail: `${minimumPhotos}${ko ? "장 이상" : "+"}` }] : []),
    ...(minimumCharacters > 0 ? [{ icon: Type, label: ko ? "본문 분량" : "Body length", detail: `${minimumCharacters.toLocaleString(ko ? "ko-KR" : "en-US")}${ko ? "자 이상" : "+ characters"}` }] : []),
    ...(minimumVideos > 0 ? [{ icon: Video, label: ko ? "필수 영상" : "Required videos", detail: `${minimumVideos}${ko ? "개 이상" : "+"}` }] : []),
    ...(review.mapLinkRequired ? [{ icon: Link2, label: ko ? "지도 위치 링크" : "Map location link", detail: ko ? "필수" : "Required" }] : []),
    ...requirements.requiredMentions.map((mention) => ({ icon: MessageCircleMore, label: mention, detail: ko ? "필수 언급" : "Required mention" })),
    ...review.requiredLinks.map((link) => ({ icon: Link2, label: ko ? "필수 링크" : "Required link", detail: link })),
  ];

  return (
    <section className="result-card requirements-card">
      <ResultHeading
        index="01"
        label="BRIGHT DATA + QWEN"
        title={ko ? "캠페인 요구사항" : "Campaign requirements"}
        aside={<span className="evidence-badge"><Check size={13} /> {ko ? "공개 공고 수집 완료" : "Public source captured"}</span>}
      />
      <div className="campaign-overview">
        <div>
          <span>CAMPAIGN</span>
          <strong>{requirements.campaignName}</strong>
          <small>{requirements.brand}</small>
        </div>
        <div className="campaign-deadline">
          <CalendarDays size={17} />
          <span>{ko ? "마감일" : "Deadline"}</span>
          <strong>{requirements.deadline || (ko ? "미확인" : "Not specified")}</strong>
        </div>
      </div>
      <div className="requirement-grid">
        {requirementRows.map((row, index) => {
          const Icon = row.icon;
          return (
            <div className="requirement-row" key={`${row.label}-${index}`}>
              <Icon size={17} strokeWidth={1.8} />
              <span>{row.label}</span>
              <small>{row.detail}</small>
            </div>
          );
        })}
      </div>
      {(review.requiredHashtags.length > 0 || review.otherRequiredMissions.length > 0 || requirements.selectionBoosters.length > 0 || requirements.conditionalRequirements.length > 0) && (
        <div className="requirement-footnotes">
          {review.requiredHashtags.length > 0 && (
            <div><span>HASHTAGS</span><p>{review.requiredHashtags.join("  ")}</p></div>
          )}
          {review.otherRequiredMissions.length > 0 && (
            <div><span>{ko ? "필수 미션" : "REQUIRED MISSIONS"}</span><p>{review.otherRequiredMissions.join(" · ")}</p></div>
          )}
          {requirements.selectionBoosters.length > 0 && (
            <div><span>{ko ? "선정 우대사항 · 선택" : "SELECTION BOOSTERS · OPTIONAL"}</span><p>{requirements.selectionBoosters.map((item) => item.description).join(" · ")}</p></div>
          )}
          {requirements.conditionalRequirements.length > 0 && (
            <div><span>{ko ? "조건부 미션" : "CONDITIONAL"}</span><p>{requirements.conditionalRequirements.map((item) => item.requirement).join(" · ")}</p></div>
          )}
        </div>
      )}
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
        label="NOSANA GPU + QWEN"
        title={locale === "ko" ? "미디어 분석" : "Media intelligence"}
        aside={<span className="evidence-badge is-purple"><Sparkles size={13} /> {locale === "ko" ? "GPU 분류 완료" : "GPU-classified"}</span>}
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

export function GeneratedContent({ generation, uploads, locale }: { generation: GenerationResult; uploads: UploadedMedia[]; locale: Locale }) {
  const previewMap = useMemo(() => new Map(uploads.map((item) => [item.file.name, item.preview])), [uploads]);
  const markerPattern = /^\[PHOTO:\s*(.*?)\s*[—-]\s*(.*?)\]$/;

  return (
    <section className="generated-layout">
      <article className="result-card draft-card">
        <ResultHeading index="03" label="QWEN CLOUD" title={locale === "ko" ? "블로그 초안" : "Blog draft"} aside={<CopyButton value={`${generation.title}\n\n${generation.blogDraft}`} locale={locale} />} />
        <div className="draft-title-block">
          <span>{locale === "ko" ? "생성된 제목" : "GENERATED TITLE"}</span>
          <h3>{generation.title}</h3>
        </div>
        <div className="draft-paper">
          {generation.blogDraft.split("\n").map((line, index) => {
            const match = line.trim().match(markerPattern);
            if (match) {
              const [, fileName, description] = match;
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
        label="DAYTONA SANDBOX"
        title={locale === "ko" ? "미션 검수" : "Deterministic compliance"}
        aside={<span className="evidence-badge is-dark"><ShieldCheck size={13} /> {locale === "ko" ? "코드로 실행" : "Executed as code"}</span>}
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
