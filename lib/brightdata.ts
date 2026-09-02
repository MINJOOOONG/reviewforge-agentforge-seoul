import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { optionalEnv } from "@/lib/env";
import { fetchWithTimeout, ProviderError } from "@/lib/http";
import { providerError, providerLog } from "@/lib/logger";

const ENDPOINT = "https://api.brightdata.com/request";
const MCP_ENDPOINT = "https://mcp.brightdata.com/mcp";

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
  return Boolean(getApiKey());
}

function assertPublicHttpUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProviderError("Bright Data", "Enter a valid campaign URL.", 400);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ProviderError("Bright Data", "Only public HTTP or HTTPS URLs are supported.", 400);
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
    throw new ProviderError("Bright Data", "The campaign URL must be accessible from the public internet.", 400);
  }
  return url.toString();
}

function safeMcpErrorMessage(error: unknown, apiKey: string) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replaceAll(apiKey, "[redacted]")
    .replace(/([?&]token=)[^&\s)]+/gi, "$1[redacted]")
    .slice(0, 500);
}

async function requestViaMcp(url: string, purpose: string, timeoutMs: number) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new ProviderError("Bright Data", "The Bright Data API key is not configured.", 503);
  }

  const endpoint = new URL(MCP_ENDPOINT);
  endpoint.searchParams.set("token", apiKey);
  const client = new Client({ name: "reviewforge", version: "0.1.0" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(endpoint);

  providerLog("BrightData", "MCP START", { hostname: new URL(url).hostname, purpose });
  try {
    const startedAt = Date.now();
    const connectTimeout = Math.min(timeoutMs, 15_000);
    await client.connect(transport, { timeout: connectTimeout, maxTotalTimeout: connectTimeout });
    const remainingTimeout = Math.max(1_000, timeoutMs - (Date.now() - startedAt));
    const result = await client.callTool(
      { name: "scrape_as_markdown", arguments: { url } },
      undefined,
      { timeout: remainingTimeout, maxTotalTimeout: remainingTimeout },
    );
    const rawContent = result && typeof result === "object"
      ? (result as { content?: unknown }).content
      : undefined;
    if (!Array.isArray(rawContent)) {
      throw new ProviderError("Bright Data", "Bright Data MCP returned an unsupported task response.");
    }

    const content = rawContent
      .map((block) => {
        if (!block || typeof block !== "object") return "";
        const item = block as { type?: unknown; text?: unknown; resource?: unknown };
        if (item.type === "text" && typeof item.text === "string") return item.text;
        if (item.type === "resource" && item.resource && typeof item.resource === "object") {
          const text = (item.resource as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if ((result as { isError?: unknown }).isError === true) {
      throw new ProviderError(
        "Bright Data",
        content ? `Bright Data MCP rejected the request: ${content.slice(0, 300)}` : "Bright Data MCP rejected the request.",
      );
    }
    if (!content) {
      throw new ProviderError("Bright Data", "Bright Data MCP returned an empty campaign page.");
    }

    const requestId = transport.sessionId || `mcp-${Date.now()}`;
    providerLog("BrightData", "MCP SUCCESS", { requestId, characters: content.length, purpose });
    return { content, requestId };
  } catch (error) {
    const safeError = error instanceof ProviderError
      ? error
      : new ProviderError("Bright Data", `Bright Data MCP failed: ${safeMcpErrorMessage(error, apiKey)}`);
    providerError("BrightData", safeError);
    throw safeError;
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function requestViaWebUnlocker(url: string, purpose: string, timeoutMs: number) {
  const apiKey = getApiKey();
  const zone = getZone();
  if (!apiKey || !zone) {
    throw new ProviderError("Bright Data", "The Bright Data API key or Web Unlocker zone is not configured.", 503);
  }

  providerLog("BrightData", "Web Unlocker START", { hostname: new URL(url).hostname, purpose });
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
          ...(purpose === "naver-search" ? { country: "kr" } : {}),
          ...(optionalEnv("BRIGHT_DATA_RENDER") === "true" ? { render: "true" } : {}),
        }),
      },
      timeoutMs,
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

    providerLog("BrightData", "Web Unlocker SUCCESS", { requestId, characters: content.length, purpose });
    return { content, requestId };
  } catch (error) {
    providerError("BrightData", error);
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("Bright Data", error instanceof Error ? error.message : String(error));
  }
}

async function requestUrl(url: string, purpose = "campaign", timeoutMs = 75_000) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new ProviderError("Bright Data", "The Bright Data API key is not configured.", 503);
  }

  if (getZone()) {
    try {
      return await requestViaWebUnlocker(url, purpose, timeoutMs);
    } catch (error) {
      providerLog("BrightData", "Web Unlocker unavailable; retrying through free MCP", {
        purpose,
        reason: error instanceof Error ? error.message.slice(0, 240) : "Unknown Web Unlocker error",
      });
    }
  }

  return requestViaMcp(url, purpose, timeoutMs);
}

export async function fetchCampaign(url: string) {
  const safeUrl = assertPublicHttpUrl(url);
  const result = await requestUrl(safeUrl, "campaign");
  const pageTitle = result.content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return { ...result, pageTitle, url: safeUrl };
}

function cleanSearchTerm(value: string) {
  return value
    .replace(/체험단|캠페인|리뷰어\s*모집|블로그\s*체험/gi, " ")
    .replace(/[|｜].*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

export type NaverBusinessResearch = {
  query: string;
  content: string;
  sourceUrls: string[];
  requestIds: string[];
};

export async function fetchNaverBusinessResearch(
  input: {
    brand: string;
    campaignName: string;
    requiredKeywords: string[];
    providedItems: string[];
  },
): Promise<NaverBusinessResearch> {
  const brand = cleanSearchTerm(input.brand);
  const campaignName = cleanSearchTerm(input.campaignName);
  const placeholder = /not identified|not specified|unknown|미확인|알 수 없음/i;
  const seed = !placeholder.test(brand) && brand.length >= 2 ? brand : campaignName;
  if (!seed) return { query: "", content: "", sourceUrls: [], requestIds: [] };

  const hints = [...input.requiredKeywords, ...input.providedItems]
    .map(cleanSearchTerm)
    .filter((value) => value && value !== seed && !placeholder.test(value));
  const queries = Array.from(new Set([
    [seed, hints[0]].filter(Boolean).join(" "),
    [seed, hints[1], "특징 후기"].filter(Boolean).join(" "),
  ])).map((query) => query.slice(0, 120)).slice(0, 2);
  const searchUrls = queries.map((query) => `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query)}`);
  providerLog("BrightData", "Searching Naver for business context...", { query: seed, searches: searchUrls.length });

  const settled = await Promise.allSettled(
    searchUrls.map((url) => requestUrl(assertPublicHttpUrl(url), "naver-search", 20_000)),
  );
  const successful = settled.flatMap((result, index) =>
    result.status === "fulfilled" ? [{ ...result.value, url: searchUrls[index], query: queries[index] }] : [],
  );

  if (!successful.length) {
    providerLog("BrightData", "Naver research unavailable; continuing with campaign page only", { query: seed });
    return { query: seed, content: "", sourceUrls: [], requestIds: [] };
  }

  const content = successful
    .map((result) => `NAVER QUERY: ${result.query}\n${result.content.slice(0, 18_000)}`)
    .join("\n\n---\n\n");
  const sourceUrls = Array.from(new Set([
    ...successful.map((result) => result.url),
  ])).slice(0, 20);

  providerLog("BrightData", "Naver business research complete", {
    query: seed,
    searches: successful.length,
    characters: content.length,
  });
  return {
    query: seed,
    content,
    sourceUrls,
    requestIds: successful.flatMap((result) => result.requestId ? [result.requestId] : []),
  };
}

export async function healthCheck(probe = false) {
  if (!isConfigured()) {
    return { ok: false, detail: "Bright Data API key missing" };
  }
  const transport = getZone() ? "Web Unlocker REST with MCP fallback" : "Bright Data MCP free tier";
  if (!probe) return { ok: true, detail: `${transport} configured` };
  const result = await requestUrl("https://geo.brdtest.com/welcome.txt", "health-check");
  return { ok: Boolean(result.content.trim()), detail: `${transport} responded` };
}
