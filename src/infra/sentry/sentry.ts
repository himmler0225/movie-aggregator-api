import * as Sentry from '@sentry/node';

let enabled = false;

/**
 * Error tracking is opt-in: without SENTRY_DSN nothing is initialised and
 * captureUnexpected() is a no-op, so local/dev runs never phone home.
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN?.trim();

  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    // Errors only; no performance tracing or request bodies.
    tracesSampleRate: 0,
  });
  enabled = true;
}

export function captureUnexpected(
  error: unknown,
  context?: { method?: string; path?: string },
) {
  if (!enabled) return;

  Sentry.withScope((scope) => {
    if (context?.method) scope.setTag('http.method', context.method);
    if (context?.path) scope.setTag('http.route', context.path);
    Sentry.captureException(error);
  });
}
