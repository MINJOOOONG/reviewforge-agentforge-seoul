import { NextResponse } from "next/server";
import { demoPause, runDeterministicCompliance, type ComplianceInput } from "@/lib/demo";
import { isDemoMode } from "@/lib/env";
import { apiError, ProviderError } from "@/lib/http";
import { providerLog } from "@/lib/logger";
import { campaignRequirementsSchema } from "@/lib/schemas";
import { assertRateLimit } from "@/lib/rate-limit";
import type { ComplianceResult } from "@/types/compliance";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    if (!isDemoMode()) assertRateLimit(request, "compliance", { limit: 6 });
    const raw = (await request.json()) as Partial<ComplianceInput>;
    if (!raw.requirements || typeof raw.draft !== "string") {
      throw new ProviderError("Rule Checker", "Draft or campaign requirements are missing", 400);
    }
    const input: ComplianceInput = {
      requirements: campaignRequirementsSchema.parse(raw.requirements),
      title: typeof raw.title === "string" ? raw.title : "",
      draft: raw.draft,
      uploadedPhotoCount: Number(raw.uploadedPhotoCount || 0),
      uploadedVideoCount: Number(raw.uploadedVideoCount || 0),
      unverifiedClaims: Array.isArray(raw.unverifiedClaims) ? raw.unverifiedClaims.map(String) : [],
      enabledConditions: Array.isArray(raw.enabledConditions) ? raw.enabledConditions.map(String).slice(0, 30) : [],
    };

    if (isDemoMode()) {
      providerLog("LocalEngine", "Demo deterministic verifier executed", { checks: true });
      await demoPause(540);
      const result = runDeterministicCompliance(input);
      return NextResponse.json<ComplianceResult>({
        ...result,
        source: {
          provider: "Local Engine",
          mode: "demo",
          executedAt: new Date().toISOString(),
          durationMs: 842,
        },
      });
    }
    const result = runDeterministicCompliance(input);
    return NextResponse.json<ComplianceResult>({
      ...result,
      source: {
        provider: "Local Engine",
        mode: "local",
        executedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
