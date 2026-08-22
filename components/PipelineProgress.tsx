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
    provider: "BRIGHT DATA",
    title: "Read campaign",
    description: "Extract missions and rules from the public brief",
    Icon: DatabaseZap,
  },
  {
    id: "media" as const,
    provider: "NOSANA",
    title: "See every frame",
    description: "Classify scenes and photo quality on GPU",
    Icon: ScanSearch,
  },
  {
    id: "generate" as const,
    provider: "QWEN CLOUD",
    title: "Write with evidence",
    description: "Create a review grounded in photos and notes",
    Icon: Sparkles,
  },
  {
    id: "compliance" as const,
    provider: "DAYTONA",
    title: "Verify in code",
    description: "Verify every requirement with sandboxed code",
    Icon: TerminalSquare,
  },
];

const applyDefinitions = [
  {
    id: "campaign" as const,
    provider: "BRIGHT DATA",
    title: "Read campaign",
    description: "Extract the offer and selection criteria",
    Icon: DatabaseZap,
  },
  {
    id: "generate" as const,
    provider: "QWEN CLOUD",
    title: "Write to apply",
    description: "Create three honest pre-visit application messages",
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
    ? { campaign: "공개 공고에서 제공 내역과 모집 조건 추출", generate: "방문 전 사실만 사용한 신청 문구 3종 생성", media: "", compliance: "" }
    : { campaign: "공개 페이지에서 미션과 조건 추출", media: "GPU에서 사진 품질과 장면 분류", generate: "사진과 메모에 근거한 후기 생성", compliance: "샌드박스 코드로 조건 결정론적 검수" };
  const koreanTitles: Record<PipelineStepId, string> = {
    campaign: "캠페인 읽기",
    media: "사진 분석하기",
    generate: mode === "apply" ? "신청 문구 쓰기" : "근거로 후기 쓰기",
    compliance: "코드로 검증하기",
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
