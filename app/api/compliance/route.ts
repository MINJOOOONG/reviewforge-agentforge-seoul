import { NextResponse } from "next/server";
import { verifyCompliance, type DaytonaComplianceInput } from "@/lib/daytona";
import { demoPause, runDeterministicCompliance } from "@/lib/demo";
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
    const raw = (await request.json()) as Partial<DaytonaComplianceInput>;
    if (!raw.requirements || typeof raw.draft !== "string") {
      throw new ProviderError("Daytona", "Draft or campaign requirements are missing", 400);
    }
    const input: DaytonaComplianceInput = {
      requirements: campaignRequirementsSchema.parse(raw.requirements),
      draft: raw.draft,
      uploadedPhotoCount: Number(raw.uploadedPhotoCount || 0),
      uploadedVideoCount: Number(raw.uploadedVideoCount || 0),
      unverifiedClaims: Array.isArray(raw.unverifiedClaims) ? raw.unverifiedClaims.map(String) : [],
    };

    if (isDemoMode()) {
      providerLog("Daytona", "Demo deterministic verifier executed", { checks: true });
      await demoPause(540);
      const result = runDeterministicCompliance(input);
      return NextResponse.json<ComplianceResult>({
        ...result,
        source: {
          provider: "Daytona",
          mode: "demo",
          sandboxId: "demo-daytona-sandbox",
          executedAt: new Date().toISOString(),
          durationMs: 842,
        },
      });
    }
    return NextResponse.json(await verifyCompliance(input));
  } catch (error) {
    return apiError(error);
  }
}
