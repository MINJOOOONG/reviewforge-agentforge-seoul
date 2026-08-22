import { Daytona, type Sandbox } from "@daytona/sdk";
import { optionalEnv } from "@/lib/env";
import { fetchWithTimeout, ProviderError } from "@/lib/http";
import { providerError, providerLog } from "@/lib/logger";
import type { CampaignRequirements } from "@/types/campaign";
import type { ComplianceResult } from "@/types/compliance";

export type DaytonaComplianceInput = {
  requirements: CampaignRequirements;
  title?: string;
  draft: string;
  uploadedPhotoCount: number;
  uploadedVideoCount: number;
  unverifiedClaims?: string[];
  enabledConditions?: string[];
};

const verifier = String.raw`
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync("input.json", "utf8"));
const { requirements, title = "", draft, uploadedPhotoCount, uploadedVideoCount, unverifiedClaims = [], enabledConditions = [] } = input;
const checks = [];
const count = (text, fragment) => fragment ? text.split(fragment).length - 1 : 0;
const review = requirements.reviewRequirements || {};
const keywordRules = requirements.keywordRules || {};
const requiredKeywords = [...new Set([...(keywordRules.requiredKeywords || []), ...(requirements.requiredKeywords || [])])];
const minimumKeywordCounts = { ...(review.minimumKeywordCounts || {}), ...(requirements.minimumKeywordCounts || {}) };
const minimumPhotos = review.minimumPhotos ?? requirements.minimumPhotos ?? 0;
const minimumVideos = review.minimumVideos ?? (requirements.videoRequired ? 1 : 0);
const minimumCharacters = review.minimumCharacters ?? requirements.minimumCharacters ?? 0;
const requiredLinks = [...new Set([...(review.requiredLinks || []), ...(requirements.requiredLinks || [])])];
const requiredHashtags = [...new Set([...(review.requiredHashtags || []), ...(requirements.requiredHashtags || [])])];

for (const keyword of requiredKeywords) {
  const actual = count(draft, keyword);
  const expected = minimumKeywordCounts[keyword] ?? keywordRules.minimumOccurrences ?? 1;
  checks.push({
    name: "Keyword · " + keyword,
    status: actual >= expected ? "PASS" : "FAIL",
    detail: actual + " / " + expected + "회",
  });
}

for (const keyword of keywordRules.titleKeywords || []) {
  checks.push({
    name: "제목 키워드 · " + keyword,
    status: title.includes(keyword) ? "PASS" : "FAIL",
    detail: title.includes(keyword) ? "제목에 포함" : "제목에서 찾을 수 없음",
  });
}

for (const keyword of keywordRules.bodyKeywords || []) {
  const actual = count(draft, keyword);
  const expected = minimumKeywordCounts[keyword] ?? keywordRules.minimumOccurrences ?? 1;
  checks.push({
    name: "본문 키워드 · " + keyword,
    status: actual >= expected ? "PASS" : "FAIL",
    detail: actual + " / " + expected + "회",
  });
}

const textLength = [...draft.replace(/\s/g, "")].length;
checks.push({
  name: "본문 글자 수",
  status: textLength >= minimumCharacters ? "PASS" : "FAIL",
  detail: textLength + " / " + minimumCharacters + "자",
});
checks.push({
  name: "업로드 사진",
  status: uploadedPhotoCount >= minimumPhotos ? "PASS" : "FAIL",
  detail: uploadedPhotoCount + " / " + minimumPhotos + "장",
});

if (minimumVideos > 0) {
  checks.push({
    name: "필수 동영상",
    status: uploadedVideoCount >= minimumVideos ? "PASS" : "FAIL",
    detail: uploadedVideoCount + " / " + minimumVideos + "개",
  });
}

for (const hashtag of requiredHashtags) {
  checks.push({
    name: "Hashtag · " + hashtag,
    status: draft.includes(hashtag) ? "PASS" : "FAIL",
    detail: draft.includes(hashtag) ? "본문에 포함" : "본문에서 찾을 수 없음",
  });
}
for (const link of requiredLinks) {
  checks.push({
    name: "필수 링크",
    status: draft.includes(link) ? "PASS" : "FAIL",
    detail: draft.includes(link) ? link : link + " 누락",
  });
}
if (review.mapLinkRequired) {
  const mapLinkPattern = /(map\.naver\.com|place\.map\.kakao\.com|maps\.app\.goo\.gl|google\.[^/\s]+\/maps)/i;
  const included = mapLinkPattern.test(draft);
  checks.push({ name: "지도 위치 링크", status: included ? "PASS" : "FAIL", detail: included ? "지도 링크 포함" : "지도 링크 누락" });
}
for (const mention of requirements.requiredMentions) {
  checks.push({
    name: "필수 언급 · " + mention,
    status: draft.includes(mention) ? "PASS" : "FAIL",
    detail: draft.includes(mention) ? "본문에 포함" : "본문에서 찾을 수 없음",
  });
}
for (const booster of requirements.selectionBoosters || []) {
  checks.push({ name: "선정 우대 · " + booster.description, status: "OPTIONAL", detail: "선택 우대사항 · 점수 제외" });
}
for (const conditional of requirements.conditionalRequirements || []) {
  if (!enabledConditions.includes(conditional.condition)) {
    checks.push({ name: "조건부 · " + conditional.requirement, status: "NA", detail: conditional.condition + " 미사용" });
    continue;
  }
  let passed = true;
  if (conditional.requiredHashtag) {
    passed = conditional.position === "top"
      ? draft.split("\n").find((line) => line.trim())?.includes(conditional.requiredHashtag) === true
      : draft.includes(conditional.requiredHashtag);
  }
  checks.push({ name: "조건부 · " + conditional.requirement, status: passed ? "PASS" : "FAIL", detail: passed ? "조건 충족" : "조건 미충족" });
}
for (const claim of unverifiedClaims) {
  checks.push({
    name: "사실 확인 · " + claim,
    status: "WARNING",
    detail: "출처에서 확인되지 않아 단정하지 않음",
  });
}

const summary = {
  pass: checks.filter((check) => check.status === "PASS").length,
  warning: checks.filter((check) => check.status === "WARNING").length,
  fail: checks.filter((check) => check.status === "FAIL").length,
};
const scoredChecks = checks.filter((check) => ["PASS", "WARNING", "FAIL"].includes(check.status));
const possible = Math.max(scoredChecks.length, 1);
const score = Math.round(((summary.pass + summary.warning * 0.5) / possible) * 100);
console.log(JSON.stringify({ score, checks, summary }));
`;

export function isConfigured() {
  return Boolean(optionalEnv("DAYTONA_API_KEY"));
}

export async function verifyCompliance(input: DaytonaComplianceInput): Promise<ComplianceResult> {
  if (!isConfigured()) throw new ProviderError("Daytona", "DAYTONA_API_KEY is not configured", 503);
  const started = Date.now();
  const daytona = new Daytona();
  let sandbox: Sandbox | undefined;
  let sandboxId: string | undefined;

  providerLog("Daytona", "Running compliance code...");
  try {
    sandbox = await daytona.create(
      {
        language: "typescript",
        ephemeral: true,
        ttlMinutes: 5,
        networkBlockAll: true,
        labels: { app: "reviewforge", purpose: "compliance-verification" },
      },
      { timeout: 90 },
    );
    sandboxId = sandbox.id;
    await sandbox.fs.uploadFiles([
      { source: Buffer.from(JSON.stringify(input)), destination: "input.json" },
      { source: Buffer.from(verifier), destination: "verify.mjs" },
    ]);
    const execution = await sandbox.process.executeCommand(
      "node verify.mjs",
      undefined,
      undefined,
      40,
    );
    if (execution.exitCode !== 0) {
      throw new ProviderError(
        "Daytona",
        `Compliance verifier exited with code ${execution.exitCode}`,
        502,
        { output: execution.result.slice(0, 1_000) },
      );
    }
    const stdout = execution.result.trim();
    const jsonLine = stdout.split("\n").filter(Boolean).at(-1);
    if (!jsonLine) throw new ProviderError("Daytona", "Compliance verifier returned no JSON output");
    const result = JSON.parse(jsonLine) as Omit<ComplianceResult, "source">;
    providerLog("Daytona", "Complete", { sandboxId, score: result.score });
    return {
      ...result,
      source: {
        provider: "Daytona",
        mode: "real",
        sandboxId,
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
      },
    };
  } catch (error) {
    providerError("Daytona", error);
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("Daytona", error instanceof Error ? error.message : String(error));
  } finally {
    if (sandbox) {
      try {
        await sandbox.delete(60, true);
        providerLog("Daytona", "Sandbox deleted", { sandboxId });
      } catch (cleanupError) {
        providerError("Daytona cleanup", cleanupError);
      }
    }
  }
}

export async function healthCheck(probe = false) {
  const apiKey = optionalEnv("DAYTONA_API_KEY");
  if (!apiKey) return { ok: false, detail: "DAYTONA_API_KEY missing" };
  if (!probe) return { ok: true, detail: "Sandbox API configured" };

  const endpoint = (optionalEnv("DAYTONA_API_URL") || "https://app.daytona.io/api").replace(/\/+$/, "");
  const response = await fetchWithTimeout(
    `${endpoint}/health/ready`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    8_000,
  );
  return { ok: response.ok, detail: response.ok ? "Daytona API ready" : `Daytona returned HTTP ${response.status}` };
}
