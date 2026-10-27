import type { CookieOptions, Request, Response } from 'express';
import { REFRESH_TOKEN_TTL_SECONDS } from '../../shared/constants/auth.constant';

/**
 * The refresh token lives in an httpOnly cookie scoped to the auth routes: page
 * scripts cannot read it (XSS-safe) and it survives closing the browser.
 * The frontend (review-mine.com) and API (be.review-mine.com) are same-site, so
 * SameSite=Lax cookies are sent on the frontend's credentialed requests.
 */
export const REFRESH_COOKIE_NAME = 'cf_rt';

const COOKIE_PATH = '/api/auth';

function cookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: COOKIE_PATH,
  };
}

export function setRefreshCookie(
  res: Response,
  token: string,
  secure: boolean,
) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...cookieOptions(secure),
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearRefreshCookie(res: Response, secure: boolean) {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions(secure));
}

/** Minimal Cookie header parsing (avoids pulling in cookie-parser for one value). */
export function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== REFRESH_COOKIE_NAME) continue;
    const value = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
