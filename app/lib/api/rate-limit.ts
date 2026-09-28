type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitEntry = { count: number; resetAt: number };

const buckets = new Map<string, RateLimitEntry>();

export function checkRateLimit(request: Request, options: RateLimitOptions) {
  const now = Date.now();
  const client = getClientIdentifier(request);
  const bucketKey = `${options.key}:${client}`;
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getClientIdentifier(request: Pick<Request, "headers">): string {
  // Sayt Vercel-dədir: `x-real-ip`-ni Vercel özü yazır, müştəri onu dəyişə
  // bilmir. `cf-connecting-ip` isə yalnız Cloudflare arxasında etibarlıdır —
  // Vercel onu silmir, ona görə əvvəl BİRİNCİ yoxlananda hücumçu hər sorğuda
  // başqa dəyər yazıb limitləri keçirdi. x-forwarded-for zəncirinin sol
  // tərəfini müştəri yazır, ona görə son halqa götürülür.
  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwardedChain = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const value = realIp || forwardedChain?.at(-1) || "unknown";
  return value.replace(/[^a-fA-F0-9:.,-]/g, "").slice(0, 80) || "unknown";
}
