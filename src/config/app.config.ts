import { registerAs } from '@nestjs/config';
import type { AppConfig } from './app-config.type';
import { APP_URL_DEFAULTS, TRAILING_SLASH_PATTERN } from '../shared/constants';

export type { AppConfig } from './app-config.type';

export const APP_CONFIG_KEY = 'app';

function stripTrailingSlash(url: string): string {
  return url.replace(TRAILING_SLASH_PATTERN, '');
}

function parseCorsOrigins(raw?: string): string[] {
  return (
    raw
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  );
}

/** Shared CORS origin option for Express and Socket.IO gateways. */
export function resolveCorsOriginOption(
  corsOrigins: string[],
): string[] | true {
  return corsOrigins.length ? corsOrigins : true;
}

/** Single entry point for reading process.env — do not use process.env elsewhere. */
export function loadAppConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT ?? '3001', 10),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
    jwtSecret: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me',
    frontendUrl: stripTrailingSlash(
      process.env.FRONTEND_URL ?? APP_URL_DEFAULTS.frontend,
    ),
    apiPublicUrl: stripTrailingSlash(
      process.env.API_PUBLIC_URL ?? APP_URL_DEFAULTS.api,
    ),
    defaultLocale: 'vi',
    supabaseUrl: process.env.SUPABASE_URL?.trim() ?? '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY?.trim() ?? '',
    googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? '',
  };
}

export default registerAs(APP_CONFIG_KEY, loadAppConfig);
