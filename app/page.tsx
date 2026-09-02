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
import { MediaUploader, type UploadedMedia } from "@/components/MediaUploader";
import { PipelineProgress, type PipelineStepId, type PipelineStepState } from "@/components/PipelineProgress";
import {
  ExecutionReceipt,
  GeneratedContent,
  RequirementsCard,
} from "@/components/ResultCards";
import type { CampaignAnalysisResult, CampaignRequirements } from "@/types/campaign";
import type { ComplianceResult } from "@/types/compliance";
import type { GenerationResult } from "@/types/generation";
import { MAX_MEDIA_UPLOADS, type MediaAnalysisResult } from "@/types/media";
import type { ApplicationGenerationResult } from "@/types/application";
import type { Locale } from "@/types/locale";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
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
    campaignName: "Campaign analysis unavailable",
    brand: "Not identified",
    providedItems: [],
    recruitmentConditions: [],
    visitConditions: {
      basePartySize: null,
      maxPartySize: null,
      additionalPersonFee: null,
      additionalPersonAgeThreshold: null,
      petAllowed: null,
      reservationRequired: null,
      availableTimes: [],
      parkingConditions: null,
      companionConditions: [],
      otherConditions: [],
    },
    reviewRequirements: {
      minimumPhotos: null,
      minimumVideos: null,
      minimumCharacters: null,
      mapLinkRequired: null,
      requiredLinks: [],
      titleKeywords: [],
      bodyKeywords: [],
      customKeywordRequired: null,
      customKeywordCount: null,
      minimumKeywordCounts: {},
      requiredHashtags: [],
      otherRequiredMissions: [],
    },
    keywordRules: {
      requiredKeywords: [],
      titleKeywords: [],
      bodyKeywords: [],
      customKeywordRequired: null,
      customKeywordCount: null,
      minimumOccurrences: null,
      appliesToTitle: null,
      appliesToBody: null,
    },
    selectionBoosters: [],
    conditionalRequirements: [],
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

function parseRequiredTerms(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[,\n]/)
        .map((term) => term.trim())
        .filter(Boolean),
    ),
  );
}

function mergeReviewConstraints(
  requirements: CampaignRequirements,
  minimumCharactersRaw: string,
  requiredTermsRaw: string,
): CampaignRequirements {
  const requestedMinimum = minimumCharactersRaw.trim() ? Number(minimumCharactersRaw) : 0;
  const campaignMinimum = Math.max(
    requirements.reviewRequirements.minimumCharacters ?? 0,
    requirements.minimumCharacters ?? 0,
  );
  const effectiveMinimum = Math.max(campaignMinimum, requestedMinimum);
  const terms = parseRequiredTerms(requiredTermsRaw);
  const hashtags = terms.filter((term) => term.startsWith("#"));
  const mentions = terms.filter((term) => !term.startsWith("#"));
  const requiredHashtags = Array.from(new Set([
    ...requirements.reviewRequirements.requiredHashtags,
    ...requirements.requiredHashtags,
    ...hashtags,
  ]));

  return {
    ...requirements,
    minimumCharacters: effectiveMinimum,
    requiredMentions: Array.from(new Set([...requirements.requiredMentions, ...mentions])),
    requiredHashtags,
    reviewRequirements: {
      ...requirements.reviewRequirements,
      minimumCharacters: effectiveMinimum,
      requiredHashtags,
    },
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
        canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("Could not create the sample image"))), "image/png"),
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
      if (!context) throw new Error("Could not create an image optimization context.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const quality = Math.max(0.5, 0.82 - attempt * 0.08);
      best = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (best && best.size <= targetBytes) break;
      scale *= 0.82;
    }

    if (!best) throw new Error("Could not optimize the image.");
    const baseName = file.name.replace(/\.[^.]+$/, "") || "review-photo";
    return new File([best], `${baseName}.webp`, { type: "image/webp", lastModified: file.lastModified });
  } finally {
    bitmap?.close();
  }
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>("ko");
  const [workMode, setWorkMode] = useState<WorkMode>("apply");
  const [campaignUrl, setCampaignUrl] = useState("");
  const [applicantKeywords, setApplicantKeywords] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [reviewMinimumCharacters, setReviewMinimumCharacters] = useState("");
  const [reviewRequiredTerms, setReviewRequiredTerms] = useState("");
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
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => () => uploadsRef.current.forEach((item) => URL.revokeObjectURL(item.preview)), []);
  useEffect(() => {
    if (running || !hasRun) return;

    const frame = window.requestAnimationFrame(() => {
      window.history.replaceState(null, "", "#results");
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [running, hasRun, application, generation, errors.length]);

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
    const remaining = Math.max(0, MAX_MEDIA_UPLOADS - uploadsRef.current.length);
    const allowed = files.filter((file) => file.size <= 18 * 1024 * 1024).slice(0, remaining);
    if (allowed.length < files.length) setFormError(`You can add up to ${MAX_MEDIA_UPLOADS} photos, with a maximum original size of 18 MB each.`);
    if (!allowed.length) return;

    setProcessingUploads(true);
    try {
      const optimized = await Promise.all(allowed.map(optimizeImageFile));
      setUploads((current) => [
        ...current,
        ...optimized.map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) })),
      ]);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Image optimization failed.");
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
      setApplicantKeywords(locale === "ko" ? "28세, 강남 직장인 커플, 맛집 탐방과 글쓰기를 좋아함" : "28 years old, working couple in Gangnam, food explorer, enjoys writing");
    } else {
      const files = await createSampleFiles();
      setUploads((current) => {
        current.forEach((item) => URL.revokeObjectURL(item.preview));
        return files.map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }));
      });
      setPersonalNote(locale === "ko" ? "메인 메뉴의 담백한 맛과 바삭한 식감의 조합이 좋았어요. 매장이 차분해서 사진을 편하게 찍을 수 있었고 음식은 따뜻하게 나왔습니다." : "I liked the balance of the main dish's mild flavor and crisp texture. The space was calm enough to take photos comfortably, and the food arrived warm.");
      setReviewMinimumCharacters("1500");
      setReviewRequiredTerms(locale === "ko" ? "성수맛집, 데이트코스, #성수맛집" : "Seongsu restaurant, date spot, #SeongsuRestaurant");
    }
    setFormError("");
  }, [locale, workMode]);

  const handleGenerate = async () => {
    setFormError("");
    let validUrl = false;
    try {
      const parsed = new URL(campaignUrl);
      validUrl = ["http:", "https:"].includes(parsed.protocol);
    } catch {
      validUrl = false;
    }
    if (!validUrl) return setFormError("Enter a valid public campaign URL.");
    if (workMode === "review" && !uploads.length) return setFormError("Upload at least one visit photo for analysis.");
    if (workMode === "review" && !personalNote.trim()) return setFormError("Add at least one firsthand note so the draft stays grounded.");
    if (workMode === "review" && reviewMinimumCharacters.trim()) {
      const requestedMinimum = Number(reviewMinimumCharacters);
      if (!Number.isInteger(requestedMinimum) || requestedMinimum < 1 || requestedMinimum > 10_000) {
        return setFormError(locale === "ko" ? "최소 글자 수는 1~10,000 사이의 정수로 입력해 주세요." : "Enter a whole-number minimum between 1 and 10,000 characters.");
      }
    }
    if (workMode === "review") {
      const requiredTerms = parseRequiredTerms(reviewRequiredTerms);
      if (requiredTerms.length > 30) {
        return setFormError(locale === "ko" ? "필수 용어와 태그는 최대 30개까지 입력할 수 있습니다." : "Add up to 30 required terms and hashtags.");
      }
      if (requiredTerms.some((term) => term.length > 100)) {
        return setFormError(locale === "ko" ? "필수 용어와 태그는 항목당 100자 이하로 입력해 주세요." : "Keep each required term or hashtag under 100 characters.");
      }
    }

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
    let campaignEvidence = "";
    let campaignSucceeded = false;
    let mediaItems: MediaAnalysisResult["items"] = [];
    let generated: GenerationResult | null = null;
    const upstreamFailures: string[] = [];

    updateStep("campaign", "running");
    try {
      const result = await readResponse<CampaignAnalysisResult>(
        await fetch("/api/analyze-campaign", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: campaignUrl, language: locale }),
        }),
      );
      requirements = workMode === "review"
        ? mergeReviewConstraints(result.requirements, reviewMinimumCharacters, reviewRequiredTerms)
        : result.requirements;
      campaignEvidence = result.campaignEvidence || "";
      campaignSucceeded = true;
      setCampaign({ ...result, requirements });
      updateStep("campaign", "success");
    } catch (error) {
      const failure = error as Error & { provider?: string };
      upstreamFailures.push(failure.provider || "Web Reader");
      setErrors((current) => [...current, { provider: failure.provider || "Web Reader", message: failure.message }]);
      updateStep("campaign", "error", failure.message);
    }

    if (workMode === "apply") {
      if (!campaignSucceeded) {
        const message = locale === "ko"
          ? "공개 공고 링크를 읽지 못해 신청 문구를 만들지 않았습니다. URL을 다시 확인해 주세요."
          : "The public campaign page could not be read. Check the URL and try again.";
        setErrors((current) => [...current, { provider: "Application Writer", message }]);
        updateStep("generate", "error", message);
      } else {
        updateStep("generate", "running");
        try {
          const result = await readResponse<ApplicationGenerationResult>(
            await fetch("/api/generate-application", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requirements, campaignEvidence, applicantKeywords, language: locale }),
            }),
          );
          setApplication(result);
          updateStep("generate", "success");
        } catch (error) {
          const failure = error as Error & { provider?: string };
          setErrors((current) => [...current, { provider: failure.provider || "Application Writer", message: failure.message }]);
          updateStep("generate", "error", failure.message);
        }
      }
      setRunning(false);
      return;
    }

    if (!campaignSucceeded) {
      const message = locale === "ko"
        ? "공개 공고 링크를 읽지 못해 후기를 생성하지 않았습니다. URL이 올바르고 외부에서 열리는지 확인해 주세요."
        : "The review was not generated because the campaign URL could not be verified.";
      updateStep("media", "error", message);
      updateStep("generate", "error", message);
      updateStep("compliance", "error", message);
      setRunning(false);
      return;
    }

    updateStep("media", "running");
    try {
      const form = new FormData();
      form.set("language", locale);
      uploads.forEach((item) => form.append("files", item.file, item.file.name));
      const result = await readResponse<MediaAnalysisResult>(
        await fetch("/api/analyze-media", { method: "POST", body: form }),
      );
      mediaItems = result.items;
      setMedia(result);
      updateStep("media", "success");
    } catch (error) {
      const failure = error as Error & { provider?: string };
      upstreamFailures.push(failure.provider || "Media Reader");
      setErrors((current) => [...current, { provider: failure.provider || "Media Reader", message: failure.message }]);
      updateStep("media", "error", failure.message);
    }

    updateStep("generate", "running");
    try {
      const form = new FormData();
      form.set("requirements", JSON.stringify(requirements));
      form.set("campaignEvidence", campaignEvidence);
      form.set("media", JSON.stringify(mediaItems));
      form.set("personalNote", personalNote);
      form.set("language", locale);
      uploads.forEach((item) => form.append("files", item.file, item.file.name));
      generated = await readResponse<GenerationResult>(await fetch("/api/generate", { method: "POST", body: form }));
      setGeneration(generated);
      updateStep("generate", "success");
    } catch (error) {
      const failure = error as Error & { provider?: string };
      upstreamFailures.push(failure.provider || "Review Writer");
      setErrors((current) => [...current, { provider: failure.provider || "Review Writer", message: failure.message }]);
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
            title: generated?.title || "",
            draft: generated?.blogDraft || "",
            uploadedPhotoCount: uploads.length,
            uploadedVideoCount: 0,
            unverifiedClaims: generated?.unverifiedClaims || [],
            enabledConditions: [],
            upstreamFailures,
          }),
        }),
      );
      setCompliance(result);
      updateStep("compliance", "success");
    } catch (error) {
      const failure = error as Error & { provider?: string };
      setErrors((current) => [...current, { provider: failure.provider || "Rule Checker", message: failure.message }]);
      updateStep("compliance", "error", failure.message);
    }
    setRunning(false);
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
  const ko = locale === "ko";

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="ReviewForge home">
          <span><Flame size={18} fill="currentColor" /></span>
          REVIEWFORGE
        </a>
        <div className="header-actions">
          <div className="language-switch" aria-label="Language">
            <button type="button" className={ko ? "is-active" : ""} onClick={() => setLocale("ko")}>한국어</button>
            <button type="button" className={!ko ? "is-active" : ""} onClick={() => setLocale("en")}>EN</button>
          </div>
          <div className={`mode-pill ${DEMO_MODE ? "is-demo" : "is-real"}`}>
            <i /> {DEMO_MODE ? "DEMO MODE" : "LIVE URL"}
          </div>
        </div>
      </header>

      <div id="top" className="hero-shell">
        <section className="hero">
          <div className="hero-copy">
            <h1>{ko ? <><span>누구나</span><em>인플루언서로.</em></> : <><span>Anyone can be</span><em>an influencer.</em></>}</h1>
            <p>{ko ? <>음식점, 카페, 뷰티샵 등 방문형 체험단의 신청부터<br /> 방문 후 후기 작성까지 함께합니다.</> : "From getting selected to publishing a compliant review, built for real visits to restaurants, cafés, beauty studios, stays, and classes."}</p>
            <a href="#forge" className="hero-link">{ko ? "시작하기" : "START FORGING"} <ArrowDown size={16} /></a>
          </div>
        </section>
      </div>

      <section className="journey-shell" aria-labelledby="journey-title">
        <div className="journey-heading">
          <span>{ko ? "지금 필요한 단계" : "CHOOSE YOUR MOMENT"}</span>
          <h2 id="journey-title">{ko ? "무엇을 도와드릴까요?" : "Where are you in the journey?"}</h2>
        </div>
        <div className="journey-tabs">
          <button type="button" className={workMode === "apply" ? "is-active" : ""} aria-pressed={workMode === "apply"} onClick={() => selectMode("apply")} disabled={running}>
            <span>01</span>
            <div><strong>{ko ? "신청하기" : "Apply"}</strong><small>{ko ? "공고에 맞춘 신청 한마디로 선정 가능성을 높입니다." : "Get selected with a campaign-specific application message."}</small></div>
            <ArrowRight size={20} />
          </button>
          <button type="button" className={workMode === "review" ? "is-active" : ""} aria-pressed={workMode === "review"} onClick={() => selectMode("review")} disabled={running}>
            <span>02</span>
            <div><strong>{ko ? "후기 작성" : "Write Review"}</strong><small>{ko ? "실제 방문 경험을 미션에 맞는 후기로 완성합니다." : "Turn your real visit into a mission-compliant review."}</small></div>
            <ArrowRight size={20} />
          </button>
        </div>
      </section>

      <section id="forge" className="forge-shell">
        <div className="forge-header">
          <div>
            <span className="section-number">01</span>
            <p>{workMode === "apply" ? (ko ? "선정 가능성 높이기" : "GET SELECTED") : (ko ? "실제 방문으로 쓰기" : "WRITE FROM YOUR VISIT")}</p>
            <h2>{workMode === "apply" ? (ko ? <>캠페인에 맞게.<br />나답게.</> : <>Campaign-specific.<br />Made for you.</>) : (ko ? <>진짜 방문을.<br />미션에 맞게.</> : <>Your real visit.<br />Mission-compliant.</>)}</h2>
          </div>
          <button type="button" className="sample-button" onClick={loadSample} disabled={running || processingUploads}>
            <WandSparkles size={15} /> {ko ? "데모 입력 채우기" : "Load demo input"}
          </button>
        </div>

        <div className={`forge-form ${workMode === "apply" ? "is-apply" : ""}`}>
          <div className="form-column form-campaign">
            <label htmlFor="campaign-url"><span>01</span> {ko ? "캠페인 URL" : "Campaign URL"}</label>
            <p>{ko ? "음식점, 카페, 뷰티, 숙박, 클래스 등 지역 방문형 체험단의 공개 공고" : "A public brief for a local restaurant, café, beauty, stay, or class campaign"}</p>
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
                <label htmlFor="applicant-keywords"><span>02</span> {ko ? "나의 강점" : "Applicant Highlights"} <small>{ko ? "선택" : "Optional"}</small></label>
                <p>{ko ? "신청 문구에서 강조할 개인 특성을 쉼표로 구분해 주세요" : "Add the personal strengths you want to highlight, separated by commas"}</p>
              </div>
              <textarea
                id="applicant-keywords"
                placeholder={ko ? "예: 28세, 강남 직장인 커플, 맛집 탐방과 글쓰기를 좋아함" : "e.g. 28, working couple in Gangnam, food explorer, enjoys writing"}
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
            <label><span>02</span> {ko ? "사진 업로드" : "Media Upload"} <small>{uploads.length.toString().padStart(2, "0")} / {MAX_MEDIA_UPLOADS}</small></label>
            <p>{ko ? "직접 방문해 촬영한 사진을 올리면 글의 흐름에 맞게 정리합니다" : "Upload photos from your visit and arrange them for the story"}</p>
            <MediaUploader items={uploads} onAdd={addFiles} onRemove={removeFile} disabled={running || processingUploads} locale={locale} />
          </div>

          <div className="form-column form-note">
            <div>
              <label htmlFor="personal-note"><span>03</span> {ko ? "나의 방문 메모" : "Personal Note"}</label>
              <p>{ko ? "AI가 꾸며내지 않도록 방문 현장에서 직접 느낀 점을 적어 주세요" : "Share what you actually experienced so the AI stays grounded"}</p>
            </div>
            <textarea
              id="personal-note"
              placeholder={ko ? "예: 소스의 고소한 맛이 기억에 남았고 창가 자연광이 좋아 사진을 찍기 편했어요." : "e.g. The sauce had a rich, nutty flavor, and the window light made it easy to take photos."}
              value={personalNote}
              maxLength={4000}
              onChange={(event) => setPersonalNote(event.target.value)}
              disabled={running}
            />
            <span className="char-count">{personalNote.length.toLocaleString()} / 4,000</span>
          </div>

          <div className="form-column form-review-rules">
            <div>
              <label><span>04</span> {ko ? "추가 작성 조건" : "Additional Requirements"} <small>{ko ? "선택" : "Optional"}</small></label>
              <p>{ko ? "공고 조건에 원하는 글자 수와 필수 용어를 더할 수 있어요" : "Add your own length target and required terms to the campaign brief"}</p>
            </div>
            <div className="review-rule-fields">
              <div className="review-rule-field">
                <label className="review-subfield-label" htmlFor="review-minimum-characters">{ko ? "최소 글자 수" : "Minimum length"}</label>
                <div className="review-number-wrap">
                  <input
                    id="review-minimum-characters"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="10000"
                    step="100"
                    placeholder={ko ? "예: 1500" : "e.g. 1500"}
                    value={reviewMinimumCharacters}
                    onChange={(event) => setReviewMinimumCharacters(event.target.value)}
                    disabled={running}
                  />
                  <span>{ko ? "자 이상" : "characters+"}</span>
                </div>
                <div className="review-length-presets" aria-label={ko ? "글자 수 빠른 선택" : "Quick length selection"}>
                  {["1000", "1500", "2000"].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={reviewMinimumCharacters === value ? "is-active" : ""}
                      onClick={() => setReviewMinimumCharacters(value)}
                      disabled={running}
                    >
                      {Number(value).toLocaleString(locale === "ko" ? "ko-KR" : "en-US")}+
                    </button>
                  ))}
                </div>
              </div>
              <div className="review-rule-field">
                <label className="review-subfield-label" htmlFor="review-required-terms">{ko ? "필수 용어 · #태그" : "Required terms · #tags"}</label>
                <textarea
                  id="review-required-terms"
                  placeholder={ko ? "예: 강남맛집, 데이트코스, #강남맛집" : "e.g. Gangnam restaurant, date spot, #GangnamEats"}
                  value={reviewRequiredTerms}
                  maxLength={1500}
                  onChange={(event) => setReviewRequiredTerms(event.target.value)}
                  disabled={running}
                />
                <small className="review-rule-hint">{ko ? "쉼표 또는 줄바꿈으로 구분 · 태그는 # 포함" : "Separate with commas or new lines · include # for tags"}</small>
              </div>
            </div>
          </div>
          </>}

          {formError && <div className="form-error"><CircleAlert size={16} /> {formError}</div>}

          <button type="button" className="generate-button" onClick={handleGenerate} disabled={running || processingUploads}>
            <span className="generate-icon">{running || processingUploads ? <LoaderCircle className="spin" size={22} /> : <Sparkles size={22} />}</span>
            <span><strong>{processingUploads ? (ko ? "사진 최적화 중…" : "Optimizing evidence…") : running ? (ko ? "에이전트 작업 중…" : "Agents are forging…") : workMode === "apply" ? (ko ? "신청 문구 만들기" : "Create Application Messages") : (ko ? "후기 만들기" : "Create My Review")}</strong><small>{processingUploads ? (ko ? "이미지 준비 중" : "Preparing images") : running ? `${completedCount} / ${totalSteps} ${ko ? "단계 완료" : "steps complete"}` : workMode === "apply" ? (ko ? "공고 읽기 → 맞춤 문구" : "Read brief → Custom message") : (ko ? "공고 분석 · 사진 배치 · 조건 확인" : "Analyze brief · Place photos · Check rules")}</small></span>
            <ArrowRight size={23} />
          </button>
        </div>
      </section>

      <div id="pipeline" className="pipeline-shell">
        <PipelineProgress steps={steps} mode={workMode} locale={locale} />
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
                <h2>{running ? (ko ? "근거를 바탕으로 생성하고 있습니다." : "Your evidence is being forged.") : completedCount === totalSteps ? workMode === "apply" ? (ko ? "선정을 위한 첫 문장이 준비됐습니다." : "Your first move, ready.") : (ko ? "공고 하나, 준비된 후기 하나." : "One brief. One ready draft.") : (ko ? "완료된 결과만 정확히 보여드립니다." : "Partial output, honestly reported.")}</h2>
              </div>
              {!running && (
                <button type="button" className="rerun-button" onClick={handleGenerate}>
                  <RotateCcw size={15} /> {ko ? "다시 실행" : "Run again"}
                </button>
              )}
            </div>

            <div className="results-stack">
              {workMode === "apply" ? (
                campaign && application && (
                  <ApplicationResults result={application} locale={locale} />
                )
              ) : (
                <>
                  <ExecutionReceipt campaign={campaign} media={media} generation={generation} compliance={compliance} locale={locale} />
                  {campaign && <RequirementsCard requirements={campaign.requirements} sourceProvider={campaign.source.provider} locale={locale} />}
                  {generation && campaign && (
                    <GeneratedContent
                      generation={generation}
                      uploads={uploads}
                      requirements={campaign.requirements}
                      compliance={compliance}
                      locale={locale}
                    />
                  )}
                </>
              )}
              {running && (
                <div className="results-loading"><LoaderCircle className="spin" size={20} /> {ko ? "에이전트 결과가 순서대로 도착하고 있습니다." : "Agent results are arriving one step at a time."}</div>
              )}
            </div>
          </>
        )}
      </div>

      <section className="proof-strip">
        {workMode === "apply" ? (
          <div><span>APPLY PIPELINE</span><strong>Web Reader</strong><ArrowRight size={14} /><strong>Application Writer</strong></div>
        ) : (
          <div><span>REVIEW PIPELINE</span><strong>Web Reader</strong><ArrowRight size={14} /><strong>Photo Organizer</strong><ArrowRight size={14} /><strong>Review Writer</strong><ArrowRight size={14} /><strong>Rule Checker</strong></div>
        )}
        <p><CheckCircle2 size={14} /> {DEMO_MODE ? (ko ? "데모 데이터로 전체 흐름을 확인합니다" : "Demo data shows the full flow") : (ko ? "API 키 없이 입력한 공개 링크를 읽습니다" : "Reads the submitted public URL without API keys")}</p>
      </section>

      <footer>
        <div><Flame size={15} fill="currentColor" /> REVIEWFORGE</div>
        <p>{ko ? "실제 경험으로 생성하고, 코드로 검증합니다." : "Grounded creation. Deterministic verification."}</p>
        <div className="integration-status">
          <span className="integration-label">{ko ? "실행 방식" : "ENGINE"}</span>
          <div className="integration-list">
            <span className="integration-item"><i className="status-dot status-connected" />{ko ? "내장 엔진" : "Built-in"}<small>{ko ? "준비됨" : "Ready"}</small></span>
          </div>
        </div>
      </footer>
    </main>
  );
}
