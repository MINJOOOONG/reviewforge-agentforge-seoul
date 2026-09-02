"use client";

import { Check, CircleAlert, DatabaseZap, LoaderCircle, ScanSearch, Sparkles, TerminalSquare } from "lucide-react";
import type { Locale } from "@/types/locale";

export type PipelineStepId = "campaign" | "media" | "generate" | "compliance";
export type PipelineStepStatus = "idle" | "running" | "success" | "error";

export type PipelineStepState = {
  id: PipelineStepId;
  status: PipelineStepStatus;
  error?: string;
};

const definitions = [
  {
    id: "campaign" as const,
    provider: "WEB READER",
    title: "Read campaign",
    description: "Extract missions and rules from the public brief",
    Icon: DatabaseZap,
  },
  {
    id: "media" as const,
    provider: "PHOTO ORGANIZER",
    title: "Order the photos",
    description: "Arrange uploaded photos for the story",
    Icon: ScanSearch,
  },
  {
    id: "generate" as const,
    provider: "REVIEW WRITER",
    title: "Write with evidence",
    description: "Create a review grounded in photos and notes",
    Icon: Sparkles,
  },
  {
    id: "compliance" as const,
    provider: "RULE CHECKER",
    title: "Check the rules",
    description: "Check the draft against campaign requirements",
    Icon: TerminalSquare,
  },
];

const applyDefinitions = [
  {
    id: "campaign" as const,
    provider: "WEB READER",
    title: "Read campaign",
    description: "Extract the offer and selection criteria",
    Icon: DatabaseZap,
  },
  {
    id: "generate" as const,
    provider: "APPLICATION WRITER",
    title: "Write to apply",
    description: "Create one honest pre-visit application message",
    Icon: Sparkles,
  },
];

function StatusIcon({ status }: { status: PipelineStepStatus }) {
  if (status === "running") return <LoaderCircle className="spin" size={16} />;
  if (status === "success") return <Check size={16} strokeWidth={3} />;
  if (status === "error") return <CircleAlert size={16} />;
  return <span className="idle-dot" />;
}

export function PipelineProgress({ steps, mode = "review", locale }: { steps: PipelineStepState[]; mode?: "apply" | "review"; locale: Locale }) {
  const visibleDefinitions = mode === "apply" ? applyDefinitions : definitions;
  const koreanDescriptions: Record<PipelineStepId, string> = mode === "apply"
    ? { campaign: "공개 공고에서 제공 내역과 모집 조건 추출", generate: "방문 전 사실만 사용한 맞춤 신청 문구 생성", media: "", compliance: "" }
    : { campaign: "공개 페이지에서 미션과 조건 추출", media: "업로드 사진을 글의 흐름에 맞게 정리", generate: "사진과 메모에 근거한 후기 생성", compliance: "캠페인 조건과 생성 결과를 비교" };
  const koreanTitles: Record<PipelineStepId, string> = {
    campaign: "캠페인 읽기",
    media: "사진 분석하기",
    generate: mode === "apply" ? "신청 문구 쓰기" : "근거로 후기 쓰기",
    compliance: "조건 확인하기",
  };
  return (
    <section className="pipeline" aria-label={locale === "ko" ? "에이전트 파이프라인 진행 상태" : "Agent pipeline progress"}>
      <div className="section-kicker">
        <span>{locale === "ko" ? (mode === "apply" ? "신청 파이프라인" : "실시간 에이전트 파이프라인") : (mode === "apply" ? "APPLICATION PIPELINE" : "LIVE AGENT PIPELINE")}</span>
        <span className="pipeline-route">{mode === "apply" ? "URL → CAMPAIGN → APPLICATION" : "URL → MEDIA → DRAFT → QA"}</span>
      </div>
      <div className={`pipeline-grid ${mode === "apply" ? "is-apply" : ""}`}>
        {visibleDefinitions.map((definition, index) => {
          const state = steps.find((step) => step.id === definition.id) ?? {
            id: definition.id,
            status: "idle" as const,
          };
          const Icon = definition.Icon;
          return (
            <div className={`pipeline-step is-${state.status}`} key={definition.id}>
              <div className="pipeline-index">0{index + 1}</div>
              <div className="pipeline-icon"><Icon size={20} strokeWidth={1.65} /></div>
              <div className="pipeline-copy">
                <span>{definition.provider}</span>
                <strong>{locale === "ko" ? koreanTitles[definition.id] : definition.title}</strong>
                <small>{state.error || (locale === "ko" ? koreanDescriptions[definition.id] : definition.description)}</small>
              </div>
              <div className="pipeline-status"><StatusIcon status={state.status} /></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
