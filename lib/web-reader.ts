import { lookup } from "node:dns/promises";
import { get as httpGet, type IncomingMessage, type RequestOptions } from "node:http";
import { get as httpsGet } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { fetchWithTimeout, ProviderError } from "@/lib/http";
import { providerLog } from "@/lib/logger";

const READER_ENDPOINT = "https://r.jina.ai/";
const DIRECT_FETCH_MAX_BYTES = 2 * 1024 * 1024;
const DIRECT_FETCH_MAX_REDIRECTS = 3;
const DIRECT_FETCH_MAX_TEXT_CHARS = 120_000;

type ResolvedAddress = {
  address: string;
  family: number;
};

function assertPublicHttpUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProviderError("Web Reader", "Enter a valid campaign URL.", 400);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ProviderError("Web Reader", "Only public HTTP or HTTPS URLs are supported.", 400);
  }
  if (url.username || url.password) {
    throw new ProviderError("Web Reader", "Campaign URLs containing credentials are not supported.", 400);
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new ProviderError("Web Reader", "Only standard HTTP and HTTPS ports are supported.", 400);
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
    throw new ProviderError("Web Reader", "The campaign URL must be accessible from the public internet.", 400);
  }
  return url.toString();
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized.startsWith("::ffff:")) return isPrivateAddress(normalized.slice(7));

  if (isIP(normalized) === 4) {
    const parts = normalized.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && parts[2] === 0) ||
      (a === 192 && b === 0 && parts[2] === 2) ||
      (a === 192 && b === 88 && parts[2] === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && parts[2] === 100) ||
      (a === 203 && b === 0 && parts[2] === 113) ||
      a >= 224
    );
  }

  if (isIP(normalized) === 6) {
    const firstGroup = Number.parseInt(normalized.split(":")[0] || "0", 16);
    const secondGroup = Number.parseInt(normalized.split(":")[1] || "0", 16);
    return (
      !Number.isFinite(firstGroup) ||
      firstGroup < 0x2000 ||
      firstGroup > 0x3fff ||
      (firstGroup === 0x2001 && secondGroup <= 0x01ff) ||
      normalized.startsWith("2001:db8:") ||
      normalized.startsWith("2002:") ||
      normalized.startsWith("3fff:")
    );
  }

  return true;
}

async function lookupBeforeDeadline(hostname: string, deadline: number) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new ProviderError("Web Reader", "The campaign page request timed out.", 504);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new ProviderError("Web Reader", "The campaign page request timed out.", 504)),
          remaining,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function assertPublicDestination(value: string, deadline: number) {
  const safeUrl = new URL(assertPublicHttpUrl(value));
  const hostname = safeUrl.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const literalFamily = isIP(hostname);
  const addresses: ResolvedAddress[] = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await lookupBeforeDeadline(hostname, deadline).catch((error) => {
        if (error instanceof ProviderError) throw error;
        return [];
      });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new ProviderError("Web Reader", "The campaign URL must resolve only to a public internet address.", 400);
  }
  return { safeUrl, addresses };
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== "#") return named[code.toLowerCase()] ?? entity;
    const point = code[1]?.toLowerCase() === "x"
      ? Number.parseInt(code.slice(2), 16)
      : Number.parseInt(code.slice(1), 10);
    try {
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    } catch {
      return entity;
    }
  });
}

function htmlAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeHtmlEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

function htmlPageTitle(html: string) {
  const socialTitles = new Map<string, string>();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (htmlAttribute(match[0], "property") || htmlAttribute(match[0], "name")).toLowerCase();
    const content = htmlAttribute(match[0], "content");
    if (["og:title", "twitter:title"].includes(key) && content.length > (socialTitles.get(key)?.length || 0)) {
      socialTitles.set(key, content);
    }
  }
  const title = decodeHtmlEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (socialTitles.get("og:title") || socialTitles.get("twitter:title") || title || undefined)?.slice(0, 500);
}

function htmlToReadableText(html: string) {
  const imageDescriptions = Array.from(html.matchAll(/<(?:img|a)\b[^>]*>/gi))
    .flatMap((match) => [htmlAttribute(match[0], "alt"), htmlAttribute(match[0], "title")])
    .filter(Boolean)
    .slice(0, 100);
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|dt|dd|h[1-6]|section|article|header|footer|tr|td|th|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const visible = decodeHtmlEntities(cleaned)
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return [htmlPageTitle(html), visible, imageDescriptions.length ? `IMAGE DESCRIPTIONS\n${imageDescriptions.join("\n")}` : ""]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, DIRECT_FETCH_MAX_TEXT_CHARS);
}

function responseHeader(response: IncomingMessage, name: string) {
  const value = response.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

async function readLimitedBody(response: IncomingMessage, controller: AbortController) {
  const announced = Number(responseHeader(response, "content-length") || 0);
  if (announced > DIRECT_FETCH_MAX_BYTES) {
    response.destroy();
    controller.abort();
    throw new ProviderError("Web Reader", "The campaign page is too large to process.", 413);
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  for await (const value of response) {
    const chunk = typeof value === "string" ? Buffer.from(value) : value;
    received += chunk.byteLength;
    if (received > DIRECT_FETCH_MAX_BYTES) {
      response.destroy();
      controller.abort();
      throw new ProviderError("Web Reader", "The campaign page is too large to process.", 413);
    }
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function pinnedLookup(addresses: ResolvedAddress[]): LookupFunction {
  return (_hostname, options, callback) => {
    const requestedFamily = options.family || 0;
    const matches = requestedFamily
      ? addresses.filter(({ family }) => family === requestedFamily)
      : addresses;
    if (!matches.length) {
      const error = new Error("No validated address matches the requested network family") as NodeJS.ErrnoException;
      error.code = "ENOTFOUND";
      callback(error, []);
      return;
    }
    if (options.all) {
      callback(null, matches);
      return;
    }
    callback(null, matches[0].address, matches[0].family);
  };
}

function requestPinned(
  target: URL,
  addresses: ResolvedAddress[],
  controller: AbortController,
) {
  const options: RequestOptions = {
    agent: false,
    headers: {
      Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
      "Accept-Encoding": "identity",
      "User-Agent": "Mozilla/5.0 (compatible; ReviewForge/1.0; +https://github.com/MINJOOOONG/reviewforge-agentforge-seoul)",
    },
    lookup: pinnedLookup(addresses),
    method: "GET",
    signal: controller.signal,
  };

  return new Promise<IncomingMessage>((resolve, reject) => {
    const request = target.protocol === "https:"
      ? httpsGet(target, options, resolve)
      : httpGet(target, options, resolve);
    request.once("error", reject);
  });
}

async function requestDirect(url: string, timeoutMs = 20_000) {
  const deadline = Date.now() + Math.min(timeoutMs, 20_000);
  let current = url;

  providerLog("WebReader", "START", { hostname: new URL(url).hostname });
  for (let redirectCount = 0; redirectCount <= DIRECT_FETCH_MAX_REDIRECTS; redirectCount += 1) {
    const { safeUrl: target, addresses } = await assertPublicDestination(current, deadline);
    const controller = new AbortController();
    const remaining = Math.max(1, deadline - Date.now());
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const response = await requestPinned(target, addresses, controller);
      const status = response.statusCode || 0;

      if ([301, 302, 303, 307, 308].includes(status)) {
        response.destroy();
        const location = responseHeader(response, "location");
        if (!location || redirectCount === DIRECT_FETCH_MAX_REDIRECTS) {
          throw new ProviderError("Web Reader", "The campaign page redirected too many times.", 502);
        }
        current = new URL(location, target).toString();
        continue;
      }
      if (status < 200 || status >= 300) {
        response.destroy();
        throw new ProviderError("Web Reader", `The campaign page returned HTTP ${status}.`, 502);
      }
      const contentEncoding = responseHeader(response, "content-encoding")?.toLowerCase();
      if (contentEncoding && contentEncoding !== "identity") {
        response.destroy();
        throw new ProviderError("Web Reader", "The campaign page used an unsupported content encoding.", 415);
      }
      const contentType = responseHeader(response, "content-type")?.split(";", 1)[0].trim().toLowerCase() || "";
      if (contentType && !["text/html", "application/xhtml+xml", "text/plain"].includes(contentType)) {
        response.destroy();
        throw new ProviderError("Web Reader", "The URL did not return a readable web page.", 415);
      }
      const raw = await readLimitedBody(response, controller);
      const content = (/<html\b|<body\b|<div\b|<p\b/i.test(raw) ? htmlToReadableText(raw) : raw.trim())
        .slice(0, DIRECT_FETCH_MAX_TEXT_CHARS);
      if (!content) throw new ProviderError("Web Reader", "The campaign page did not contain readable text.", 502);
      providerLog("WebReader", "SUCCESS", { hostname: target.hostname, characters: content.length });
      return {
        content,
        pageTitle: /<[^>]+>/.test(raw) ? htmlPageTitle(raw) : undefined,
        requestId: `direct-${Date.now()}`,
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (controller.signal.aborted) throw new ProviderError("Web Reader", "The campaign page request timed out.", 504);
      throw new ProviderError("Web Reader", error instanceof Error ? error.message : String(error), 502);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new ProviderError("Web Reader", "The campaign page could not be read.", 502);
}

async function requestViaPublicReader(url: string) {
  providerLog("WebReader", "Public reader fallback START", { hostname: new URL(url).hostname });
  const response = await fetchWithTimeout(
    `${READER_ENDPOINT}${url}`,
    {
      headers: {
        Accept: "text/plain",
        "X-Return-Format": "markdown",
      },
    },
    25_000,
  );
  if (!response.ok) {
    throw new ProviderError("Web Reader", `The public reader returned HTTP ${response.status}.`, 502);
  }
  const content = (await response.text()).trim().slice(0, DIRECT_FETCH_MAX_TEXT_CHARS);
  if (!content) {
    throw new ProviderError("Web Reader", "The public reader returned no campaign text.", 502);
  }
  const pageTitle = content.match(/^Title:\s*(.+)$/im)?.[1]?.trim().slice(0, 500);
  providerLog("WebReader", "Public reader fallback SUCCESS", { hostname: new URL(url).hostname, characters: content.length });
  return { content, pageTitle, requestId: `reader-${Date.now()}` };
}

export async function readCampaignPage(url: string) {
  const safeUrl = assertPublicHttpUrl(url);
  await assertPublicDestination(safeUrl, Date.now() + 5_000);
  try {
    const result = await requestDirect(safeUrl, 7_000);
    return { ...result, provider: "Web Reader" as const, url: safeUrl };
  } catch (directError) {
    providerLog("WebReader", "Direct request unavailable; trying public reader", {
      hostname: new URL(safeUrl).hostname,
      reason: directError instanceof Error ? directError.message.slice(0, 180) : "Unknown direct request error",
    });
    const result = await requestViaPublicReader(safeUrl);
    return { ...result, provider: "Web Reader" as const, url: safeUrl };
  }
}
