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

export function PipelineProgress({ steps, mode = "review" }: { steps: PipelineStepState[]; mode?: "apply" | "review" }) {
  const visibleDefinitions = mode === "apply" ? applyDefinitions : definitions;
  return (
    <section className="pipeline" aria-label="Agent pipeline progress">
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
