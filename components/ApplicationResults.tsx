"use client";

import {
  CalendarDays,
  Check,
  Clipboard,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { ApplicationGenerationResult } from "@/types/application";
import type { CampaignRequirements } from "@/types/campaign";

type ApplicationResultsProps = {
  requirements: CampaignRequirements;
  result: ApplicationGenerationResult;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="copy-button is-compact"
      aria-label={`${label} 신청 문구 복사`}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1_600);
      }}
    >
      {copied ? <ClipboardCheck size={15} /> : <Clipboard size={15} />}
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

function SummaryDetail({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <span>{label}</span>
      <p>{values.length > 0 ? values.join(" · ") : "공고에서 확인되지 않음"}</p>
    </div>
  );
}

export function ApplicationResults({ requirements, result }: ApplicationResultsProps) {
  const keyMissions = Array.from(
    new Set([
      ...requirements.otherRequirements,
      ...requirements.requiredMentions,
      ...(requirements.requiredKeywords.length > 0
        ? [`필수 키워드: ${requirements.requiredKeywords.join(", ")}`]
        : []),
      ...(requirements.minimumPhotos > 0 ? [`사진 ${requirements.minimumPhotos}장 이상`] : []),
      ...(requirements.videoRequired ? ["영상 포함"] : []),
    ]),
  );

  return (
    <div className="apply-results">
      <section className="result-card apply-summary">
        <div className="result-heading">
          <div>
            <span>01 / BRIGHT DATA + QWEN</span>
            <h2>Campaign summary</h2>
          </div>
          <span className="evidence-badge">
            <Check size={13} /> Public source captured
          </span>
        </div>

        <div className="campaign-overview">
          <div>
            <span>CAMPAIGN</span>
            <strong>{requirements.campaignName}</strong>
            <small>{requirements.brand}</small>
          </div>
          <div className="campaign-deadline">
            <CalendarDays size={17} />
            <span>Deadline</span>
            <strong>{requirements.deadline || "미확인"}</strong>
          </div>
        </div>

        <div className="requirement-footnotes apply-summary-details">
          <SummaryDetail label="PROVIDED ITEMS" values={requirements.providedItems} />
          <SummaryDetail label="RECRUITMENT CONDITIONS" values={requirements.recruitmentConditions} />
          <SummaryDetail label="VISIT CONDITIONS" values={requirements.visitConditions} />
          <SummaryDetail label="KEY MISSIONS" values={keyMissions} />
        </div>
      </section>

      <section className="apply-messages" aria-labelledby="application-messages-title">
        <div className="result-heading">
          <div>
            <span>02 / QWEN CLOUD</span>
            <h2 id="application-messages-title">Application message</h2>
          </div>
          <span className="evidence-badge is-purple">
            <Sparkles size={13} /> {result.source.mode === "real" ? "Live generated" : "Demo generated"}
          </span>
        </div>

        <div className="apply-message-grid">
          {result.variants.slice(0, 3).map((variant, index) => (
            <article className="result-card application-card apply-message" key={`${variant.label}-${index}`}>
              <div className="result-heading">
                <div>
                  <span>{String(index + 1).padStart(2, "0")} / APPLICATION MESSAGE</span>
                  <h2>{variant.label}</h2>
                </div>
                <CopyButton value={variant.message} label={variant.label} />
              </div>
              <blockquote>{variant.message}</blockquote>
              <div className="generated-source">
                <Sparkles size={14} /> Campaign-grounded · Pre-visit language
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
