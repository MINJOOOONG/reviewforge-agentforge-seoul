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
    detail: actual + " / " + expected + " uses",
  });
}

for (const keyword of keywordRules.titleKeywords || []) {
  checks.push({
    name: "Title keyword · " + keyword,
    status: title.includes(keyword) ? "PASS" : "FAIL",
    detail: title.includes(keyword) ? "Included in title" : "Missing from title",
  });
}

for (const keyword of keywordRules.bodyKeywords || []) {
  const actual = count(draft, keyword);
  const expected = minimumKeywordCounts[keyword] ?? keywordRules.minimumOccurrences ?? 1;
  checks.push({
    name: "Body keyword · " + keyword,
    status: actual >= expected ? "PASS" : "FAIL",
    detail: actual + " / " + expected + " uses",
  });
}

const publishableDraft = draft.replace(/^\s*\[PHOTO:.*\]\s*$/gm, "");
const textLength = [...publishableDraft.replace(/\s/g, "")].length;
const placedPhotoCount = new Set(
  [...draft.matchAll(/^\s*\[PHOTO:\s*(.+?)(?:\s+[—–-]\s+.+)?\]\s*$/gm)].map((match) => match[1].trim()),
).size;
const verifiedPhotoCount = Math.min(uploadedPhotoCount, placedPhotoCount);
checks.push({
  name: "Body length",
  status: textLength >= minimumCharacters ? "PASS" : "FAIL",
  detail: textLength + " / " + minimumCharacters + " characters",
});
checks.push({
  name: "Placed photos",
  status: verifiedPhotoCount >= minimumPhotos ? "PASS" : "FAIL",
  detail: verifiedPhotoCount + " / " + minimumPhotos + " photos placed in draft",
});

if (minimumVideos > 0) {
  checks.push({
    name: "Required videos",
    status: uploadedVideoCount >= minimumVideos ? "PASS" : "FAIL",
    detail: uploadedVideoCount + " / " + minimumVideos + " videos",
  });
}

for (const hashtag of requiredHashtags) {
  checks.push({
    name: "Hashtag · " + hashtag,
    status: draft.includes(hashtag) ? "PASS" : "FAIL",
    detail: draft.includes(hashtag) ? "Included in body" : "Missing from body",
  });
}
for (const link of requiredLinks) {
  checks.push({
    name: "Required link",
    status: draft.includes(link) ? "PASS" : "FAIL",
    detail: draft.includes(link) ? link : link + " missing",
  });
}
if (review.mapLinkRequired) {
  const mapLinkPattern = /(map\.naver\.com|place\.map\.kakao\.com|maps\.app\.goo\.gl|google\.[^/\s]+\/maps)/i;
  const included = mapLinkPattern.test(draft);
  checks.push({ name: "Map location link", status: included ? "PASS" : "FAIL", detail: included ? "Map link included" : "Map link missing" });
}
for (const mention of requirements.requiredMentions) {
  checks.push({
    name: "Required mention · " + mention,
    status: draft.includes(mention) ? "PASS" : "FAIL",
    detail: draft.includes(mention) ? "Included in body" : "Missing from body",
  });
}
for (const booster of requirements.selectionBoosters || []) {
  checks.push({ name: "Selection booster · " + booster.description, status: "OPTIONAL", detail: "Optional · Excluded from score" });
}
for (const conditional of requirements.conditionalRequirements || []) {
  if (!enabledConditions.includes(conditional.condition)) {
    checks.push({ name: "Conditional · " + conditional.requirement, status: "NA", detail: conditional.condition + " not enabled" });
    continue;
  }
  let passed = true;
  if (conditional.requiredHashtag) {
    passed = conditional.position === "top"
      ? draft.split("\n").find((line) => line.trim())?.includes(conditional.requiredHashtag) === true
      : draft.includes(conditional.requiredHashtag);
  }
  checks.push({ name: "Conditional · " + conditional.requirement, status: passed ? "PASS" : "FAIL", detail: passed ? "Condition met" : "Condition not met" });
}
for (const claim of unverifiedClaims) {
  checks.push({
    name: "Fact check · " + claim,
    status: "WARNING",
    detail: "Not confirmed by the available evidence",
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
