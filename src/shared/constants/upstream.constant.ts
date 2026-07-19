export const UPSTREAM_TIMEOUT = {
  list: 5000,
  detail: 6000,
  search: 4000,
  meta: 8000,
  image: 10000,
} as const;

export type UpstreamTimeoutKind = keyof typeof UPSTREAM_TIMEOUT;

export const UPSTREAM_RETRY = {
  /** Retries after the first failed attempt (3 = up to 4 requests total). */
  maxRetries: 3,
  /** Exponential backoff between retries (ms). */
  backoffMs: [500, 1000, 2000],
  maxBackoffMs: 4000,
} as const;

/** Upstream HTTP statuses eligible for retry (besides timeout / network errors). */
export const UPSTREAM_RETRYABLE_STATUS = new Set([
  408, 429, 500, 502, 503, 504,
]);
