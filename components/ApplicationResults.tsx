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
  const visit = requirements.visitConditions;
  const review = requirements.reviewRequirements;
  const keywords = requirements.keywordRules;
  const visitConditions = [
    ...(visit.basePartySize !== null ? [`기준 ${visit.basePartySize}인`] : []),
    ...(visit.maxPartySize !== null ? [`최대 ${visit.maxPartySize}인`] : []),
    ...(visit.additionalPersonFee !== null
      ? [`${visit.additionalPersonAgeThreshold !== null ? `${visit.additionalPersonAgeThreshold}세 이상 ` : ""}추가 인원 ${visit.additionalPersonFee.toLocaleString("ko-KR")}원`]
      : []),
    ...(visit.petAllowed !== null ? [`반려동물 동반 ${visit.petAllowed ? "가능" : "불가"}`] : []),
    ...(visit.reservationRequired !== null ? [visit.reservationRequired ? "사전 예약 필수" : "사전 예약 불필요"] : []),
    ...visit.availableTimes.map((value) => `방문 가능 시간: ${value}`),
    ...(visit.parkingConditions ? [`주차: ${visit.parkingConditions}`] : []),
    ...visit.companionConditions,
    ...visit.otherConditions,
  ];
  const requiredMissions = Array.from(new Set([
    ...(review.minimumPhotos !== null ? [`사진 최소 ${review.minimumPhotos}장`] : []),
    ...(review.minimumVideos !== null && review.minimumVideos > 0 ? [`영상 최소 ${review.minimumVideos}개`] : []),
    ...(review.minimumCharacters !== null ? [`본문 ${review.minimumCharacters.toLocaleString("ko-KR")}자 이상`] : []),
    ...(review.mapLinkRequired ? ["지도 위치 링크 필수"] : []),
    ...(keywords.titleKeywords.length > 0 ? [`제목 키워드: ${keywords.titleKeywords.join(", ")}`] : []),
    ...(keywords.bodyKeywords.length > 0 ? [`본문 키워드: ${keywords.bodyKeywords.join(", ")}`] : []),
    ...(keywords.minimumOccurrences !== null ? [`키워드 ${keywords.minimumOccurrences}회 이상`] : []),
    ...(keywords.customKeywordRequired ? [`자율 키워드 ${keywords.customKeywordCount ?? 1}개 필수`] : []),
    ...review.requiredLinks.map((value) => `필수 링크: ${value}`),
    ...review.requiredHashtags.map((value) => `필수 해시태그: ${value}`),
    ...review.otherRequiredMissions,
    ...requirements.requiredMentions,
  ]));
  const selectionBoosters = requirements.selectionBoosters.map((item) => `↑ ${item.description}`);
  const conditionalRequirements = requirements.conditionalRequirements.map((item) => `조건부 · ${item.requirement}`);

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
          <SummaryDetail label="VISIT CONDITIONS · 방문 조건" values={visitConditions} />
          <SummaryDetail label="REQUIRED REVIEW MISSIONS · 필수 리뷰 미션" values={requiredMissions} />
          <SummaryDetail label="SELECTION BOOSTERS · 선정 우대사항" values={selectionBoosters} />
          <SummaryDetail label="CONDITIONAL · 조건부 미션" values={conditionalRequirements} />
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
