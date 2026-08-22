"use client";

import { Check, CircleAlert, DatabaseZap, LoaderCircle, ScanSearch, Sparkles, TerminalSquare } from "lucide-react";

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
    description: "공개 페이지에서 미션과 조건 추출",
    Icon: DatabaseZap,
  },
  {
    id: "media" as const,
    provider: "NOSANA",
    title: "See every frame",
    description: "GPU에서 사진 품질과 장면 분류",
    Icon: ScanSearch,
  },
  {
    id: "generate" as const,
    provider: "QWEN CLOUD",
    title: "Write with evidence",
    description: "사진과 메모에 근거한 후기 생성",
    Icon: Sparkles,
  },
  {
    id: "compliance" as const,
    provider: "DAYTONA",
    title: "Verify in code",
    description: "샌드박스 코드로 조건 결정론적 검수",
    Icon: TerminalSquare,
  },
];

const applyDefinitions = [
  {
    id: "campaign" as const,
    provider: "BRIGHT DATA",
    title: "Read campaign",
    description: "공개 공고에서 제공 내역과 모집 조건 추출",
    Icon: DatabaseZap,
  },
  {
    id: "generate" as const,
    provider: "QWEN CLOUD",
    title: "Write to apply",
    description: "방문 전 사실만 사용한 신청 문구 3종 생성",
    Icon: Sparkles,
  },
];

function StatusIcon({ status }: { status: PipelineStepStatus }) {
  if (status === "running") return <LoaderCircle className="spin" size={16} />;
  if (status === "success") return <Check size={16} strokeWidth={3} />;
  if (status === "error") return <CircleAlert size={16} />;
  return <span className="idle-dot" />;
}

export function PipelineProgress({ steps, mode = "review" }: { steps: PipelineStepState[]; mode?: "apply" | "review" }) {
  const visibleDefinitions = mode === "apply" ? applyDefinitions : definitions;
  return (
    <section className="pipeline" aria-label="에이전트 파이프라인 진행 상태">
      <div className="section-kicker">
        <span>{mode === "apply" ? "APPLICATION PIPELINE" : "LIVE AGENT PIPELINE"}</span>
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
                <strong>{definition.title}</strong>
                <small>{state.error || definition.description}</small>
              </div>
              <div className="pipeline-status"><StatusIcon status={state.status} /></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
