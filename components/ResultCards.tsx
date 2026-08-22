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

function CopyButton({ value, compact = false }: { value: string; compact?: boolean }) {
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
      {copied ? "Copied" : "Copy"}
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
}: {
  campaign: CampaignAnalysisResult | null;
  media: MediaAnalysisResult | null;
  generation: GenerationResult | null;
  compliance: ComplianceResult | null;
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
    <section className="execution-receipt" aria-label="Provider execution receipt">
      <div className="receipt-heading"><span>EXECUTION RECEIPT</span><small>IDs are truncated · secrets never leave the server</small></div>
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

export function RequirementsCard({ requirements }: { requirements: CampaignRequirements }) {
  const review = requirements.reviewRequirements;
  const keywordRules = requirements.keywordRules;
  const minimumPhotos = review.minimumPhotos ?? requirements.minimumPhotos;
  const minimumVideos = review.minimumVideos ?? (requirements.videoRequired ? 1 : 0);
  const minimumCharacters = review.minimumCharacters ?? requirements.minimumCharacters;
  const requirementRows = [
    ...keywordRules.requiredKeywords.map((keyword) => ({
      icon: Hash,
      label: keyword,
      detail: `${review.minimumKeywordCounts[keyword] ?? requirements.minimumKeywordCounts[keyword] ?? keywordRules.minimumOccurrences ?? 1}+ uses`,
    })),
    ...keywordRules.titleKeywords.map((keyword) => ({ icon: Hash, label: `Title · ${keyword}`, detail: "Include in title" })),
    ...keywordRules.bodyKeywords.map((keyword) => ({ icon: Hash, label: `Body · ${keyword}`, detail: `${review.minimumKeywordCounts[keyword] ?? requirements.minimumKeywordCounts[keyword] ?? keywordRules.minimumOccurrences ?? 1}+ uses` })),
    ...(minimumPhotos > 0 ? [{ icon: ImageIcon, label: "Required photos", detail: `${minimumPhotos}+` }] : []),
    ...(minimumCharacters > 0 ? [{ icon: Type, label: "Body length", detail: `${minimumCharacters.toLocaleString("en-US")}+ characters` }] : []),
    ...(minimumVideos > 0 ? [{ icon: Video, label: "Required videos", detail: `${minimumVideos}+` }] : []),
    ...(review.mapLinkRequired ? [{ icon: Link2, label: "Map location link", detail: "Required" }] : []),
    ...requirements.requiredMentions.map((mention) => ({ icon: MessageCircleMore, label: mention, detail: "Required mention" })),
    ...review.requiredLinks.map((link) => ({ icon: Link2, label: "Required link", detail: link })),
  ];

  return (
    <section className="result-card requirements-card">
      <ResultHeading
        index="01"
        label="BRIGHT DATA + QWEN"
        title="Campaign requirements"
        aside={<span className="evidence-badge"><Check size={13} /> Public source captured</span>}
      />
      <div className="campaign-overview">
        <div>
          <span>CAMPAIGN</span>
          <strong>{requirements.campaignName}</strong>
          <small>{requirements.brand}</small>
        </div>
        <div className="campaign-deadline">
          <CalendarDays size={17} />
          <span>Deadline</span>
          <strong>{requirements.deadline || "Not specified"}</strong>
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
            <div><span>REQUIRED MISSIONS</span><p>{review.otherRequiredMissions.join(" · ")}</p></div>
          )}
          {requirements.selectionBoosters.length > 0 && (
            <div><span>SELECTION BOOSTERS · OPTIONAL</span><p>{requirements.selectionBoosters.map((item) => item.description).join(" · ")}</p></div>
          )}
          {requirements.conditionalRequirements.length > 0 && (
            <div><span>CONDITIONAL</span><p>{requirements.conditionalRequirements.map((item) => item.requirement).join(" · ")}</p></div>
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
}: {
  media: MediaAnalysis[];
  generation: GenerationResult | null;
  uploads: UploadedMedia[];
}) {
  const previewMap = useMemo(() => new Map(uploads.map((item) => [item.file.name, item.preview])), [uploads]);

  return (
    <section className="result-card media-card">
      <ResultHeading
        index="02"
        label="NOSANA GPU + QWEN"
        title="Media intelligence"
        aside={<span className="evidence-badge is-purple"><Sparkles size={13} /> GPU-classified</span>}
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
          <span className="subsection-label">RECOMMENDED STORY ORDER</span>
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

export function GeneratedContent({ generation, uploads }: { generation: GenerationResult; uploads: UploadedMedia[] }) {
  const previewMap = useMemo(() => new Map(uploads.map((item) => [item.file.name, item.preview])), [uploads]);
  const markerPattern = /^\[PHOTO:\s*(.*?)\s*[—-]\s*(.*?)\]$/;

  return (
    <section className="generated-layout">
      <article className="result-card draft-card">
        <ResultHeading index="03" label="QWEN CLOUD" title="Blog draft" aside={<CopyButton value={`${generation.title}\n\n${generation.blogDraft}`} />} />
        <div className="draft-title-block">
          <span>GENERATED TITLE</span>
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

export function ComplianceCard({ result }: { result: ComplianceResult }) {
  return (
    <section className="result-card compliance-card">
      <ResultHeading
        index="04"
        label="DAYTONA SANDBOX"
        title="Deterministic compliance"
        aside={<span className="evidence-badge is-dark"><ShieldCheck size={13} /> Executed as code</span>}
      />
      <div className="compliance-layout">
        <div className="score-panel">
          <div className="score-ring" style={{ "--score": `${result.score * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{result.score}</strong><span>/ 100</span></div>
          </div>
          <span>CAMPAIGN READINESS</span>
          <h3>{result.summary.fail === 0 ? "Ready to publish" : "A few missions need attention"}</h3>
          <p>{result.summary.pass} passed · {result.summary.warning} warnings · {result.summary.fail} failed</p>
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
