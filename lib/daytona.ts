import { Daytona, type Sandbox } from "@daytona/sdk";
import { optionalEnv } from "@/lib/env";
import { fetchWithTimeout, ProviderError } from "@/lib/http";
import { providerError, providerLog } from "@/lib/logger";
import type { CampaignRequirements } from "@/types/campaign";
import type { ComplianceResult } from "@/types/compliance";

export type DaytonaComplianceInput = {
  requirements: CampaignRequirements;
  draft: string;
  uploadedPhotoCount: number;
  uploadedVideoCount: number;
  unverifiedClaims?: string[];
};

const verifier = String.raw`
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync("input.json", "utf8"));
const { requirements, draft, uploadedPhotoCount, uploadedVideoCount, unverifiedClaims = [] } = input;
const checks = [];
const count = (text, fragment) => fragment ? text.split(fragment).length - 1 : 0;

for (const keyword of requirements.requiredKeywords) {
  const actual = count(draft, keyword);
  const expected = requirements.minimumKeywordCounts[keyword] ?? 1;
  checks.push({
    name: "Keyword · " + keyword,
    status: actual >= expected ? "PASS" : "FAIL",
    detail: actual + " / " + expected + "회",
  });
}

const textLength = [...draft.replace(/\s/g, "")].length;
checks.push({
  name: "본문 글자 수",
  status: textLength >= requirements.minimumCharacters ? "PASS" : "FAIL",
  detail: textLength + " / " + requirements.minimumCharacters + "자",
});
checks.push({
  name: "업로드 사진",
  status: uploadedPhotoCount >= requirements.minimumPhotos ? "PASS" : "FAIL",
  detail: uploadedPhotoCount + " / " + requirements.minimumPhotos + "장",
});

if (requirements.videoRequired) {
  checks.push({
    name: "필수 동영상",
    status: uploadedVideoCount > 0 ? "PASS" : "FAIL",
    detail: uploadedVideoCount > 0 ? uploadedVideoCount + "개 업로드" : "필수지만 업로드되지 않음",
  });
}

for (const hashtag of requirements.requiredHashtags) {
  checks.push({
    name: "Hashtag · " + hashtag,
    status: draft.includes(hashtag) ? "PASS" : "FAIL",
    detail: draft.includes(hashtag) ? "본문에 포함" : "본문에서 찾을 수 없음",
  });
}
for (const link of requirements.requiredLinks) {
  checks.push({
    name: "필수 링크",
    status: draft.includes(link) ? "PASS" : "FAIL",
    detail: draft.includes(link) ? link : link + " 누락",
  });
}
for (const mention of requirements.requiredMentions) {
  checks.push({
    name: "필수 언급 · " + mention,
    status: draft.includes(mention) ? "PASS" : "FAIL",
    detail: draft.includes(mention) ? "본문에 포함" : "본문에서 찾을 수 없음",
  });
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
const possible = Math.max(checks.length, 1);
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
