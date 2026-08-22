import { optionalEnv } from "@/lib/env";
import { fetchWithTimeout, ProviderError } from "@/lib/http";
import { providerError, providerLog } from "@/lib/logger";

const ENDPOINT = "https://api.brightdata.com/request";

type BrightDataEnvelope = {
  status_code?: number;
  headers?: Record<string, string>;
  body?: string;
};

function getApiKey() {
  return optionalEnv("BRIGHT_DATA_API_KEY") || optionalEnv("BRIGHTDATA_API_KEY");
}

function getZone() {
  return optionalEnv("BRIGHT_DATA_ZONE") || optionalEnv("BRIGHTDATA_WEB_UNLOCKER_ZONE");
}

export function isConfigured() {
  return Boolean(getApiKey() && getZone());
}

function assertPublicHttpUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProviderError("Bright Data", "올바른 캠페인 URL을 입력해 주세요.", 400);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ProviderError("Bright Data", "HTTP 또는 HTTPS 공개 URL만 지원합니다.", 400);
  }
  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blocked) {
    throw new ProviderError("Bright Data", "공개 인터넷에서 접근 가능한 캠페인 URL만 지원합니다.", 400);
  }
  return url.toString();
}

async function requestUrl(url: string) {
  const apiKey = getApiKey();
  const zone = getZone();
  if (!apiKey || !zone) {
    throw new ProviderError("Bright Data", "Bright Data API key 또는 Web Unlocker zone이 설정되지 않았습니다.", 503);
  }

  providerLog("BrightData", "Fetching campaign...", { hostname: new URL(url).hostname });
  try {
    const response = await fetchWithTimeout(
      ENDPOINT,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          zone,
          url,
          format: "json",
          method: "GET",
          data_format: "markdown",
          debug: true,
          ...(optionalEnv("BRIGHT_DATA_RENDER") === "true" ? { render: "true" } : {}),
        }),
      },
      75_000,
    );

    const raw = await response.text();
    let envelope: BrightDataEnvelope | undefined;
    try {
      const parsed = JSON.parse(raw) as BrightDataEnvelope;
      if (parsed && typeof parsed === "object") envelope = parsed;
    } catch {
      // Bright Data can return the unlocked body directly depending on the zone response format.
    }

    const errorCode =
      response.headers.get("x-brd-error-code") || response.headers.get("x-brd-err-code");
    const errorMessage = response.headers.get("x-brd-error");
    const providerStatus = Number(response.headers.get("x-brd-status-code")) || envelope?.status_code || response.status;
    const requestId = response.headers.get("x-brd-debug") || undefined;

    if (!response.ok || errorCode || errorMessage || providerStatus >= 400) {
      throw new ProviderError(
        "Bright Data",
        errorMessage || `Web Unlocker returned status ${providerStatus}`,
        response.status === 401 ? 401 : 502,
        { code: errorCode, providerStatus, requestId },
      );
    }

    const content = typeof envelope?.body === "string" ? envelope.body : raw;
    if (!content.trim()) {
      throw new ProviderError("Bright Data", "Web Unlocker returned an empty campaign page");
    }

    providerLog("BrightData", "Complete", { requestId, characters: content.length });
    return { content, requestId };
  } catch (error) {
    providerError("BrightData", error);
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("Bright Data", error instanceof Error ? error.message : String(error));
  }
}

export async function fetchCampaign(url: string) {
  const safeUrl = assertPublicHttpUrl(url);
  const result = await requestUrl(safeUrl);
  const pageTitle = result.content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return { ...result, pageTitle, url: safeUrl };
}

export async function healthCheck(probe = false) {
  if (!isConfigured()) {
    return { ok: false, detail: "Bright Data key or Web Unlocker zone missing" };
  }
  if (!probe) return { ok: true, detail: `${getZone()} configured` };
  const result = await requestUrl("https://geo.brdtest.com/welcome.txt");
  return { ok: Boolean(result.content.trim()), detail: "Web Unlocker responded" };
}
