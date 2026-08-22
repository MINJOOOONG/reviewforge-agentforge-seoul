import { ProviderError } from "@/lib/http";

type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

/**
 * Best-effort per-instance guard for a public hackathon deployment.
 * A platform firewall or distributed limiter should replace this at larger scale.
 */
export function assertRateLimit(
  request: Request,
  bucket: string,
  options: { limit: number; windowMs?: number },
) {
  const now = Date.now();
  const windowMs = options.windowMs ?? 60_000;
  const key = `${bucket}:${clientKey(request)}`;
  const current = buckets.get(key);
  const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  entry.count += 1;
  buckets.set(key, entry);

  if (buckets.size > 1_000) {
    for (const [storedKey, stored] of buckets) {
      if (stored.resetAt <= now) buckets.delete(storedKey);
    }
  }

  if (entry.count > options.limit) {
    throw new ProviderError(
      "ReviewForge",
      `Too many requests. Try again in ${Math.ceil((entry.resetAt - now) / 1_000)} seconds.`,
      429,
    );
  }
}
