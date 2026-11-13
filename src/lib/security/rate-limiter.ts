interface RateLimitBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateLimitBucket>();

export interface RateLimitOptions {
  key: string;
  windowMs: number;
  maxRequests: number;
  nowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Sliding-window rate limiter for public booking & token endpoints.
 */
export function checkRateLimit({
  key,
  windowMs,
  maxRequests,
  nowMs = Date.now(),
}: RateLimitOptions): RateLimitResult {
  const cutoff = nowMs - windowMs;
  const existing = buckets.get(key) ?? { timestamps: [] };
  const active = existing.timestamps.filter((ts) => ts > cutoff);

  if (active.length >= maxRequests) {
    const oldestInWindow = active[0] ?? nowMs;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestInWindow + windowMs - nowMs) / 1000)
    );
    buckets.set(key, { timestamps: active });
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  active.push(nowMs);
  buckets.set(key, { timestamps: active });

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - active.length),
    retryAfterSeconds: 0,
  };
}

export function resetRateLimitBuckets(): void {
  buckets.clear();
}
