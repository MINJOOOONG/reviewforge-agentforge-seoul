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
      aria-label={`Copy ${label} application message`}
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

function SummaryDetail({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <span>{label}</span>
      <p>{values.length > 0 ? values.join(" · ") : "Not stated in the campaign brief"}</p>
    </div>
  );
}

export function ApplicationResults({ requirements, result }: ApplicationResultsProps) {
  const visit = requirements.visitConditions;
  const review = requirements.reviewRequirements;
  const keywords = requirements.keywordRules;
  const visitConditions = [
    ...(visit.basePartySize !== null ? [`Base party: ${visit.basePartySize}`] : []),
    ...(visit.maxPartySize !== null ? [`Maximum party: ${visit.maxPartySize}`] : []),
    ...(visit.additionalPersonFee !== null
      ? [`Additional guest fee${visit.additionalPersonAgeThreshold !== null ? ` (age ${visit.additionalPersonAgeThreshold}+)` : ""}: KRW ${visit.additionalPersonFee.toLocaleString("en-US")}`]
      : []),
    ...(visit.petAllowed !== null ? [`Pets ${visit.petAllowed ? "allowed" : "not allowed"}`] : []),
    ...(visit.reservationRequired !== null ? [visit.reservationRequired ? "Advance reservation required" : "No advance reservation required"] : []),
    ...visit.availableTimes.map((value) => `Available visit time: ${value}`),
    ...(visit.parkingConditions ? [`Parking: ${visit.parkingConditions}`] : []),
    ...visit.companionConditions,
    ...visit.otherConditions,
  ];
  const requiredMissions = Array.from(new Set([
    ...(review.minimumPhotos !== null ? [`At least ${review.minimumPhotos} photos`] : []),
    ...(review.minimumVideos !== null && review.minimumVideos > 0 ? [`At least ${review.minimumVideos} video(s)`] : []),
    ...(review.minimumCharacters !== null ? [`At least ${review.minimumCharacters.toLocaleString("en-US")} characters`] : []),
    ...(review.mapLinkRequired ? ["Map location link required"] : []),
    ...(keywords.titleKeywords.length > 0 ? [`Title keywords: ${keywords.titleKeywords.join(", ")}`] : []),
    ...(keywords.bodyKeywords.length > 0 ? [`Body keywords: ${keywords.bodyKeywords.join(", ")}`] : []),
    ...(keywords.minimumOccurrences !== null ? [`Use each keyword at least ${keywords.minimumOccurrences} times`] : []),
    ...(keywords.customKeywordRequired ? [`Add ${keywords.customKeywordCount ?? 1} custom keyword(s)`] : []),
    ...review.requiredLinks.map((value) => `Required link: ${value}`),
    ...review.requiredHashtags.map((value) => `Required hashtag: ${value}`),
    ...review.otherRequiredMissions,
    ...requirements.requiredMentions,
  ]));
  const selectionBoosters = requirements.selectionBoosters.map((item) => `↑ ${item.description}`);
  const conditionalRequirements = requirements.conditionalRequirements.map((item) => `Conditional · ${item.requirement}`);

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
            <strong>{requirements.deadline || "Not specified"}</strong>
          </div>
        </div>

        <div className="requirement-footnotes apply-summary-details">
          <SummaryDetail label="PROVIDED ITEMS" values={requirements.providedItems} />
          <SummaryDetail label="RECRUITMENT CONDITIONS" values={requirements.recruitmentConditions} />
          <SummaryDetail label="VISIT CONDITIONS" values={visitConditions} />
          <SummaryDetail label="REQUIRED REVIEW MISSIONS" values={requiredMissions} />
          <SummaryDetail label="SELECTION BOOSTERS" values={selectionBoosters} />
          <SummaryDetail label="CONDITIONAL MISSIONS" values={conditionalRequirements} />
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
