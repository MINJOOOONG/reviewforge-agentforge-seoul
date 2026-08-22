import { NextResponse } from "next/server";
import * as brightData from "@/lib/brightdata";
import * as daytona from "@/lib/daytona";
import { isDemoMode } from "@/lib/env";
import { apiError } from "@/lib/http";
import * as nosana from "@/lib/nosana";
import * as qwen from "@/lib/qwen";
import { assertRateLimit } from "@/lib/rate-limit";
import type { IntegrationHealth, IntegrationName } from "@/types/integrations";

export const runtime = "nodejs";

const providers = [
  { name: "brightData" as const, label: "Bright Data", configured: brightData.isConfigured, check: brightData.healthCheck },
  { name: "nosana" as const, label: "Nosana", configured: nosana.isConfigured, check: nosana.healthCheck },
  { name: "qwen" as const, label: "Qwen Cloud", configured: qwen.isConfigured, check: qwen.healthCheck },
  { name: "daytona" as const, label: "Daytona", configured: daytona.isConfigured, check: daytona.healthCheck },
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const probe = url.searchParams.get("probe") === "true";
  if (probe && !isDemoMode()) {
    try {
      assertRateLimit(request, "health-probe", { limit: 2 });
    } catch (error) {
      return apiError(error);
    }
  }
  const checkedAt = new Date().toISOString();

  if (isDemoMode()) {
    const integrations: IntegrationHealth[] = providers.map((provider) => ({
      name: provider.name,
      label: provider.label,
      state: "demo",
      detail: "Demo fixture active; set NEXT_PUBLIC_DEMO_MODE=false for the real data path",
      checkedAt,
    }));
    return NextResponse.json({ mode: "demo", integrations });
  }

  const integrations = await Promise.all(
    providers.map(async (provider): Promise<IntegrationHealth> => {
      if (!provider.configured()) {
        return { name: provider.name, label: provider.label, state: "missing", detail: "Required server configuration missing", checkedAt };
      }
      try {
        const result = await provider.check(probe);
        return {
          name: provider.name as IntegrationName,
          label: provider.label,
          state: result.ok ? (probe ? "connected" : "configured") : "unavailable",
          detail: result.detail,
          checkedAt,
        };
      } catch (error) {
        return {
          name: provider.name,
          label: provider.label,
          state: "unavailable",
          detail: error instanceof Error ? error.message : String(error),
          checkedAt,
        };
      }
    }),
  );
  return NextResponse.json({ mode: "real", probe, integrations });
}
