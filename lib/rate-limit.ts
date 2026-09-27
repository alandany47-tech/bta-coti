import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Bucket = "register" | "slug" | "login" | "api" | "media" | "share" | "demo" | "demo_quote";
type Window = Parameters<typeof Ratelimit.slidingWindow>[1];

const LIMITS: Record<Bucket, [number, Window][]> = {
  register: [
    [5, "1 m"],
    [20, "1 d"],
  ],
  slug: [
    [20, "1 m"],
    [200, "1 d"],
  ],
  login: [[10, "1 m"]],
  api: [[300, "1 m"]],
  media: [[60, "1 m"]],
  share: [[120, "1 m"]],
  demo: [[20, "1 m"]],
  demo_quote: [[30, "1 h"]],
};

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const limiters = new Map<string, Ratelimit>();

function limiter(bucket: Bucket, index: number) {
  const key = `${bucket}:${index}`;
  let instance = limiters.get(key);
  if (!instance) {
    const [tokens, window] = LIMITS[bucket][index];
    instance = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(tokens, window),
      prefix: `rl:${key}`,
    });
    limiters.set(key, instance);
  }
  return instance;
}

export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Sin Upstash configurado (desarrollo local) o si Redis falla, deja pasar la petición. */
export async function checkRateLimit(
  bucket: Bucket,
  ip: string,
): Promise<{ ok: boolean; retryAfter: number }> {
  if (!redis) return { ok: true, retryAfter: 0 };
  try {
    const results = await Promise.all(
      LIMITS[bucket].map((_, index) => limiter(bucket, index).limit(ip)),
    );
    const blocked = results.filter((r) => !r.success);
    if (blocked.length === 0) return { ok: true, retryAfter: 0 };
    const retryAfter = Math.max(
      ...blocked.map((r) => Math.ceil((r.reset - Date.now()) / 1000)),
    );
    return { ok: false, retryAfter: Math.max(retryAfter, 1) };
  } catch (error) {
    console.error("rate-limit: Redis no disponible", error);
    return { ok: true, retryAfter: 0 };
  }
}
