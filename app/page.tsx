"use client";

import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Flame,
  Link2,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApplicationResults } from "@/components/ApplicationResults";
import { IntegrationStatus } from "@/components/IntegrationStatus";
import { MediaUploader, type UploadedMedia } from "@/components/MediaUploader";
import { PipelineProgress, type PipelineStepId, type PipelineStepState } from "@/components/PipelineProgress";
import {
  ComplianceCard,
  ExecutionReceipt,
  GeneratedContent,
  MediaAndOrder,
  RequirementsCard,
} from "@/components/ResultCards";
import type { CampaignAnalysisResult, CampaignRequirements } from "@/types/campaign";
import type { ComplianceResult } from "@/types/compliance";
import type { GenerationResult } from "@/types/generation";
import type { MediaAnalysisResult } from "@/types/media";
import type { ApplicationGenerationResult } from "@/types/application";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
const initialSteps: PipelineStepState[] = [
  { id: "campaign", status: "idle" },
  { id: "media", status: "idle" },
  { id: "generate", status: "idle" },
  { id: "compliance", status: "idle" },
];

type PipelineError = { provider: string; message: string };
type WorkMode = "apply" | "review";

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload as { error?: string; provider?: string };
    throw Object.assign(new Error(error.error || `Request failed with HTTP ${response.status}`), {
      provider: error.provider,
    });
  }
  return payload as T;
}

function emptyRequirements(sourceUrl: string): CampaignRequirements {
  return {
    campaignName: "캠페인 분석 실패",
    brand: "미확인",
    providedItems: [],
    recruitmentConditions: [],
    visitConditions: [],
    requiredKeywords: [],
    minimumKeywordCounts: {},
    minimumPhotos: 0,
    videoRequired: false,
    minimumCharacters: 0,
    requiredMentions: [],
    requiredLinks: [],
    requiredHashtags: [],
    deadline: null,
    otherRequirements: [],
    sourceUrl,
  };
}

function drawSamplePhoto(canvas: HTMLCanvasElement, variant: number) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const palettes = [
    ["#40291f", "#d98555", "#f4d6a5"],
    ["#271c18", "#a9432d", "#f2bd71"],
    ["#e5d6bb", "#312721", "#b4563c"],
    ["#241f1c", "#6d5142", "#e4c9a5"],
    ["#1e2622", "#557568", "#f1dabc"],
  ];
  const [base, accent, light] = palettes[variant % palettes.length];
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, base);
  gradient.addColorStop(1, accent);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = 0.25;
  for (let index = 0; index < 18; index++) {
    context.fillStyle = index % 2 ? light : accent;
    context.beginPath();
    context.arc((index * 173 + variant * 91) % 1200, (index * 127 + variant * 67) % 800, 35 + (index % 5) * 18, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  if (variant < 2) {
    context.fillStyle = "rgba(13, 12, 10, .55)";
    context.fillRect(0, 590, 1200, 210);
    context.fillStyle = "#f2eadb";
    context.beginPath();
    context.ellipse(600, 420, variant ? 350 : 390, variant ? 225 : 250, -0.08, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#d6783e";
    context.beginPath();
    context.ellipse(600, 410, 250, 150, 0.12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#f1c35c";
    context.beginPath();
    context.arc(590, 390, 88, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#6a8a45";
    for (let index = 0; index < 8; index++) {
      context.beginPath();
      context.arc(430 + index * 48, 355 + (index % 2) * 115, 20, 0, Math.PI * 2);
      context.fill();
    }
  } else if (variant === 2) {
    context.fillStyle = "rgba(248, 240, 222, .93)";
    context.fillRect(225, 90, 750, 620);
    context.fillStyle = "#3a2c25";
    for (let index = 0; index < 7; index++) context.fillRect(320, 190 + index * 64, 560 - (index % 3) * 90, 13);
    context.fillStyle = accent;
    context.fillRect(320, 135, 260, 24);
  } else if (variant === 3) {
    context.fillStyle = "rgba(238, 219, 188, .58)";
    context.fillRect(120, 115, 960, 500);
    context.fillStyle = "#211b18";
    for (let index = 0; index < 4; index++) {
      context.fillRect(170 + index * 250, 460, 170, 25);
      context.fillRect(205 + index * 250, 485, 18, 150);
      context.fillRect(290 + index * 250, 485, 18, 150);
    }
    context.fillStyle = "#f4c878";
    for (let index = 0; index < 4; index++) {
      context.beginPath();
      context.arc(255 + index * 250, 245, 48, 0, Math.PI * 2);
      context.fill();
    }
  } else {
    context.fillStyle = "#d7c09c";
    context.fillRect(180, 140, 840, 590);
    context.fillStyle = "#31463d";
    context.fillRect(265, 245, 670, 485);
    context.fillStyle = "#f1e0c3";
    context.fillRect(420, 310, 360, 160);
    context.fillStyle = accent;
    context.fillRect(490, 350, 220, 25);
  }
  context.fillStyle = "rgba(255,255,255,.86)";
  context.font = "600 26px Arial";
  context.fillText(["HERO / FOOD", "FOOD DETAIL", "MENU", "INTERIOR", "EXTERIOR"][variant], 48, 66);
}

async function createSampleFiles() {
  const names = ["hero-dish.png", "food-detail.png", "menu-board.png", "quiet-interior.png", "storefront.png"];
  return Promise.all(
    names.map(async (name, index) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 800;
      drawSamplePhoto(canvas, index);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("샘플 이미지 생성 실패"))), "image/png"),
      );
      return new File([blob], name, { type: "image/png" });
    }),
  );
}

async function optimizeImageFile(file: File): Promise<File> {
  const targetBytes = 300 * 1024;
  if (file.size <= targetBytes) return file;

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    let best: Blob | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("이미지 최적화 컨텍스트를 만들 수 없습니다.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const quality = Math.max(0.5, 0.82 - attempt * 0.08);
      best = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (best && best.size <= targetBytes) break;
      scale *= 0.82;
    }

    if (!best) throw new Error("이미지를 최적화하지 못했습니다.");
    const baseName = file.name.replace(/\.[^.]+$/, "") || "review-photo";
    return new File([best], `${baseName}.webp`, { type: "image/webp", lastModified: file.lastModified });
  } finally {
    bitmap?.close();
  }
}

export default function Home() {
  const [workMode, setWorkMode] = useState<WorkMode>("apply");
  const [campaignUrl, setCampaignUrl] = useState("");
  const [applicantKeywords, setApplicantKeywords] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [uploads, setUploads] = useState<UploadedMedia[]>([]);
  const [steps, setSteps] = useState<PipelineStepState[]>(initialSteps);
  const [errors, setErrors] = useState<PipelineError[]>([]);
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [campaign, setCampaign] = useState<CampaignAnalysisResult | null>(null);
  const [application, setApplication] = useState<ApplicationGenerationResult | null>(null);
  const [media, setMedia] = useState<MediaAnalysisResult | null>(null);
  const [generation, setGeneration] = useState<GenerationResult | null>(null);
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [formError, setFormError] = useState("");
  const [processingUploads, setProcessingUploads] = useState(false);
  const uploadsRef = useRef<UploadedMedia[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);
  useEffect(() => () => uploadsRef.current.forEach((item) => URL.revokeObjectURL(item.preview)), []);

  const updateStep = useCallback((id: PipelineStepId, status: PipelineStepState["status"], error?: string) => {
    setSteps((current) => current.map((step) => (step.id === id ? { ...step, status, error } : step)));
  }, []);

  const selectMode = useCallback((nextMode: WorkMode) => {
    if (running || nextMode === workMode) return;
    setWorkMode(nextMode);
    setHasRun(false);
    setSteps(initialSteps);
    setErrors([]);
    setFormError("");
    setCampaign(null);
    setApplication(null);
    setMedia(null);
    setGeneration(null);
    setCompliance(null);
  }, [running, workMode]);

  const addFiles = useCallback(async (files: File[]) => {
    setFormError("");
    const remaining = Math.max(0, 12 - uploadsRef.current.length);
    const allowed = files.filter((file) => file.size <= 18 * 1024 * 1024).slice(0, remaining);
    if (allowed.length < files.length) setFormError("사진은 최대 12장, 원본 장당 18MB까지 추가할 수 있습니다.");
    if (!allowed.length) return;

    setProcessingUploads(true);
    try {
      const optimized = await Promise.all(allowed.map(optimizeImageFile));
      setUploads((current) => [
        ...current,
        ...optimized.map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) })),
      ]);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "사진 최적화에 실패했습니다.");
    } finally {
      setProcessingUploads(false);
    }
  }, []);

  const removeFile = useCallback((id: string) => {
    setUploads((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const loadSample = useCallback(async () => {
    setCampaignUrl("https://example.com/campaign/reviewforge-demo");
    if (workMode === "apply") {
      setApplicantKeywords("28세, 강남 직장인 커플, 여성, 글쓰기와 맛집 탐방을 좋아함");
    } else {
      const files = await createSampleFiles();
      setUploads((current) => {
        current.forEach((item) => URL.revokeObjectURL(item.preview));
        return files.map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }));
      });
      setPersonalNote("메인 메뉴의 담백한 맛과 바삭한 식감의 조합이 좋았어요. 매장은 차분해서 사진을 천천히 찍기 좋았고, 음식은 따뜻한 상태로 나왔습니다.");
    }
    setFormError("");
  }, [workMode]);

  const handleGenerate = async () => {
    setFormError("");
    let validUrl = false;
    try {
      const parsed = new URL(campaignUrl);
      validUrl = ["http:", "https:"].includes(parsed.protocol);
    } catch {
      validUrl = false;
    }
    if (!validUrl) return setFormError("공개된 캠페인 URL을 입력해 주세요.");
    if (workMode === "review" && !uploads.length) return setFormError("분석할 사진을 한 장 이상 업로드해 주세요.");
    if (workMode === "review" && !personalNote.trim()) return setFormError("환각을 막을 수 있도록 직접 느낀 점을 한 줄 이상 적어 주세요.");

    setRunning(true);
    setHasRun(true);
    setErrors([]);
    setSteps(initialSteps);
    setCampaign(null);
    setApplication(null);
    setMedia(null);
    setGeneration(null);
    setCompliance(null);

    let requirements = emptyRequirements(campaignUrl);
    let campaignSucceeded = false;
    let mediaItems: MediaAnalysisResult["items"] = [];
    let generated: GenerationResult | null = null;
    const upstreamFailures: string[] = [];

    updateStep("campaign", "running");
    try {
      const result = await readResponse<CampaignAnalysisResult>(
        await fetch("/api/analyze-campaign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: campaignUrl }),
        }),
      );
      requirements = result.requirements;
      campaignSucceeded = true;
      setCampaign(result);
      updateStep("campaign", "success");
    } catch (error) {
      const failure = error as Error & { provider?: string };
      upstreamFailures.push(failure.provider || "Bright Data");
      setErrors((current) => [...current, { provider: failure.provider || "Bright Data", message: failure.message }]);
      updateStep("campaign", "error", failure.message);
    }

    if (workMode === "apply") {
      if (!campaignSucceeded) {
        const message = "캠페인 근거를 확보하지 못해 신청 문구를 생성하지 않았습니다.";
        setErrors((current) => [...current, { provider: "Qwen Cloud", message }]);
        updateStep("generate", "error", message);
      } else {
        updateStep("generate", "running");
        try {
          const result = await readResponse<ApplicationGenerationResult>(
            await fetch("/api/generate-application", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requirements, applicantKeywords }),
            }),
          );
          setApplication(result);
          updateStep("generate", "success");
        } catch (error) {
          const failure = error as Error & { provider?: string };
          setErrors((current) => [...current, { provider: failure.provider || "Qwen Cloud", message: failure.message }]);
          updateStep("generate", "error", failure.message);
        }
      }
      setRunning(false);
      window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
      return;
    }

    updateStep("media", "running");
    try {
      const form = new FormData();
      uploads.forEach((item) => form.append("files", item.file, item.file.name));
      const result = await readResponse<MediaAnalysisResult>(
        await fetch("/api/analyze-media", { method: "POST", body: form }),
      );
      mediaItems = result.items;
      setMedia(result);
      updateStep("media", "success");
    } catch (error) {
      const failure = error as Error & { provider?: string };
      upstreamFailures.push(failure.provider || "Nosana");
      setErrors((current) => [...current, { provider: failure.provider || "Nosana", message: failure.message }]);
      updateStep("media", "error", failure.message);
    }

    updateStep("generate", "running");
    try {
      const form = new FormData();
      form.set("requirements", JSON.stringify(requirements));
      form.set("media", JSON.stringify(mediaItems));
      form.set("personalNote", personalNote);
      uploads.forEach((item) => form.append("files", item.file, item.file.name));
      generated = await readResponse<GenerationResult>(await fetch("/api/generate", { method: "POST", body: form }));
      setGeneration(generated);
      updateStep("generate", "success");
    } catch (error) {
      const failure = error as Error & { provider?: string };
      upstreamFailures.push(failure.provider || "Qwen Cloud");
      setErrors((current) => [...current, { provider: failure.provider || "Qwen Cloud", message: failure.message }]);
      updateStep("generate", "error", failure.message);
    }

    updateStep("compliance", "running");
    try {
      const result = await readResponse<ComplianceResult>(
        await fetch("/api/compliance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requirements,
            draft: generated?.blogDraft || "",
            uploadedPhotoCount: uploads.length,
            uploadedVideoCount: 0,
            unverifiedClaims: generated?.unverifiedClaims || [],
            upstreamFailures,
          }),
        }),
      );
      setCompliance(result);
      updateStep("compliance", "success");
    } catch (error) {
      const failure = error as Error & { provider?: string };
      setErrors((current) => [...current, { provider: failure.provider || "Daytona", message: failure.message }]);
      updateStep("compliance", "error", failure.message);
    }
    setRunning(false);
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  };

  const visibleStepIds = useMemo(
    () => workMode === "apply" ? new Set<PipelineStepId>(["campaign", "generate"]) : new Set<PipelineStepId>(["campaign", "media", "generate", "compliance"]),
    [workMode],
  );
  const completedCount = useMemo(
    () => steps.filter((step) => visibleStepIds.has(step.id) && step.status === "success").length,
    [steps, visibleStepIds],
  );
  const totalSteps = workMode === "apply" ? 2 : 4;

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="ReviewForge 홈">
          <span><Flame size={18} fill="currentColor" /></span>
          REVIEWFORGE
        </a>
        <nav>
          <a href="#forge">Forge</a>
          <a href="#pipeline">How it works</a>
          <a href="#results">Output</a>
        </nav>
        <div className={`mode-pill ${DEMO_MODE ? "is-demo" : "is-real"}`}>
          <i /> {DEMO_MODE ? "DEMO MODE" : "REAL MODE"}
        </div>
      </header>

      <div id="top" className="hero-shell">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span>LOCAL EXPERIENCE AGENT / 01</span><i /></div>
            <h1>Get selected.<br /><em>Share the real visit.</em></h1>
            <p>음식점, 카페, 뷰티샵, 숙박, 클래스 등 지역 방문형 체험단의 신청부터 실제 방문 후기와 미션 검수까지 함께합니다.</p>
            <a href="#forge" className="hero-link">START FORGING <ArrowDown size={16} /></a>
          </div>
        </section>
      </div>

      <section className="journey-shell" aria-labelledby="journey-title">
        <div className="journey-heading">
          <span>CHOOSE YOUR MOMENT</span>
          <h2 id="journey-title">무엇을 도와드릴까요?</h2>
        </div>
        <div className="journey-tabs">
          <button type="button" className={workMode === "apply" ? "is-active" : ""} aria-pressed={workMode === "apply"} onClick={() => selectMode("apply")} disabled={running}>
            <span>01</span>
            <div><strong>신청하기</strong><small>공고에 맞춘 신청 한마디로 선정 가능성을 높입니다.</small></div>
            <ArrowRight size={20} />
          </button>
          <button type="button" className={workMode === "review" ? "is-active" : ""} aria-pressed={workMode === "review"} onClick={() => selectMode("review")} disabled={running}>
            <span>02</span>
            <div><strong>후기 작성</strong><small>실제 방문 사진과 경험을 미션에 맞는 후기로 완성합니다.</small></div>
            <ArrowRight size={20} />
          </button>
        </div>
      </section>

      <section id="forge" className="forge-shell">
        <div className="forge-header">
          <div>
            <span className="section-number">01</span>
            <p>{workMode === "apply" ? "GET SELECTED" : "WRITE FROM YOUR VISIT"}</p>
            <h2>{workMode === "apply" ? <>Campaign-specific.<br />Made for you.</> : <>Your real visit.<br />Mission-compliant.</>}</h2>
          </div>
          <button type="button" className="sample-button" onClick={loadSample} disabled={running || processingUploads}>
            <WandSparkles size={15} /> 데모 입력 채우기
          </button>
        </div>

        <div className={`forge-form ${workMode === "apply" ? "is-apply" : ""}`}>
          <div className="form-column form-campaign">
            <label htmlFor="campaign-url"><span>01</span> Campaign URL</label>
            <p>음식점, 카페, 뷰티샵, 숙박, 클래스 등 지역 방문형 체험단의 공개 모집 페이지</p>
            <div className="url-input-wrap">
              <Link2 size={18} />
              <input
                id="campaign-url"
                type="url"
                placeholder="https://campaign.example.com/brief"
                value={campaignUrl}
                onChange={(event) => setCampaignUrl(event.target.value)}
                disabled={running}
              />
            </div>
          </div>

          {workMode === "apply" && (
            <div className="form-column form-note form-keywords">
              <div>
                <label htmlFor="applicant-keywords"><span>02</span> Applicant Highlights <small>선택</small></label>
                <p>나이, 활동 지역, 관심사처럼 신청 문구에서 강조할 개인 특성을 쉼표로 구분해 주세요</p>
              </div>
              <textarea
                id="applicant-keywords"
                placeholder="예: 28세, 강남 직장인 커플, 여성, 글쓰기와 맛집 탐방을 좋아함"
                value={applicantKeywords}
                maxLength={500}
                onChange={(event) => setApplicantKeywords(event.target.value)}
                disabled={running}
              />
              <span className="char-count">{applicantKeywords.length.toLocaleString()} / 500</span>
            </div>
          )}

          {workMode === "review" && <>
          <div className="form-column form-media">
            <label><span>02</span> Media Upload <small>{uploads.length.toString().padStart(2, "0")} / 12</small></label>
            <p>직접 방문해 촬영한 사진을 올리면 GPU가 장면과 품질을 분석합니다</p>
            <MediaUploader items={uploads} onAdd={addFiles} onRemove={removeFile} disabled={running || processingUploads} />
          </div>

          <div className="form-column form-note">
            <div>
              <label htmlFor="personal-note"><span>03</span> Personal Note</label>
              <p>AI가 꾸며내지 않도록, 방문 현장에서 직접 느낀 점을 Ground Truth로 남겨 주세요</p>
            </div>
            <textarea
              id="personal-note"
              placeholder="예: 소스의 고소한 맛이 기억에 남았고, 창가 쪽 자연광이 좋아 사진을 찍기 편했어요."
              value={personalNote}
              maxLength={4000}
              onChange={(event) => setPersonalNote(event.target.value)}
              disabled={running}
            />
            <span className="char-count">{personalNote.length.toLocaleString()} / 4,000</span>
          </div>
          </>}

          {formError && <div className="form-error"><CircleAlert size={16} /> {formError}</div>}

          <button type="button" className="generate-button" onClick={handleGenerate} disabled={running || processingUploads}>
            <span className="generate-icon">{running || processingUploads ? <LoaderCircle className="spin" size={22} /> : <Sparkles size={22} />}</span>
            <span><strong>{processingUploads ? "Optimizing evidence…" : running ? "Agents are forging…" : workMode === "apply" ? "신청 문구 만들기" : "후기 만들기"}</strong><small>{processingUploads ? "Preparing images" : running ? `${completedCount} / ${totalSteps} agents complete` : workMode === "apply" ? "Bright Data → Qwen Cloud" : "4 agents · 1 verified draft"}</small></span>
            <ArrowRight size={23} />
          </button>
        </div>
      </section>

      <div id="pipeline" className="pipeline-shell">
        <PipelineProgress steps={steps} mode={workMode} />
        {errors.length > 0 && (
          <div className="pipeline-errors">
            {errors.map((error, index) => (
              <div key={`${error.provider}-${index}`}><CircleAlert size={15} /><strong>{error.provider}</strong><span>{error.message}</span></div>
            ))}
          </div>
        )}
      </div>

      <div id="results" ref={resultsRef} className={`results-shell ${hasRun ? "is-visible" : ""}`}>
        {hasRun && (
          <>
            <div className="results-intro">
              <div>
                <span className="section-number">02</span>
                <p>FORGED OUTPUT</p>
                <h2>{running ? "Your evidence is being forged." : completedCount === totalSteps ? workMode === "apply" ? "Your first move, ready." : "One brief. One ready draft." : "Partial output, honestly reported."}</h2>
              </div>
              {!running && (
                <button type="button" className="rerun-button" onClick={handleGenerate}>
                  <RotateCcw size={15} /> Run again
                </button>
              )}
            </div>

            <div className="results-stack">
              {workMode === "apply" ? (
                campaign && application && <ApplicationResults requirements={campaign.requirements} result={application} />
              ) : (
                <>
                  <ExecutionReceipt campaign={campaign} media={media} generation={generation} compliance={compliance} />
                  {campaign && <RequirementsCard requirements={campaign.requirements} />}
                  {media && <MediaAndOrder media={media.items} generation={generation} uploads={uploads} />}
                  {generation && <GeneratedContent generation={generation} uploads={uploads} />}
                  {compliance && <ComplianceCard result={compliance} />}
                </>
              )}
              {running && (
                <div className="results-loading"><LoaderCircle className="spin" size={20} /> 에이전트 결과가 순서대로 도착하고 있습니다.</div>
              )}
            </div>
          </>
        )}
      </div>

      <section className="proof-strip">
        {workMode === "apply" ? (
          <div><span>APPLY PIPELINE</span><strong>Bright Data</strong><ArrowRight size={14} /><strong>Qwen Cloud</strong></div>
        ) : (
          <div><span>REVIEW PIPELINE</span><strong>Bright Data</strong><ArrowRight size={14} /><strong>Nosana</strong><ArrowRight size={14} /><strong>Qwen Cloud</strong><ArrowRight size={14} /><strong>Daytona</strong></div>
        )}
        <p><CheckCircle2 size={14} /> {DEMO_MODE ? "Demo fixtures · Real Mode keeps live provider calls" : "Live backend execution stages"}</p>
      </section>

      <footer>
        <div><Flame size={15} fill="currentColor" /> REVIEWFORGE</div>
        <p>Grounded creation. Deterministic verification.</p>
        <IntegrationStatus />
      </footer>
    </main>
  );
}
