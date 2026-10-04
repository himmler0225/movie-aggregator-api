export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export const OAUTH_STATE_BYTES = 24;

/** Short-lived access JWT (Bearer). */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Opaque refresh token lifetime. */
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * How long a rotated refresh token still works. Covers clients that never received the
 * rotation response (page unloaded mid-request, flaky mobile network) and would otherwise
 * be logged out on their next refresh.
 */
export const REFRESH_TOKEN_REUSE_GRACE_MS = 2 * 60 * 1000;
