import type { HttpService } from '@nestjs/axios';
import type { AppConfigService } from '../../config';
import { GoogleOAuthService } from './google-oauth.service';

function service() {
  const appConfig = {
    frontendUrl: 'https://review-mine.com',
    corsOrigins: ['https://review-mine.com', 'https://www.review-mine.com'],
    apiPublicUrl: 'https://be.review-mine.com',
    googleClientId: 'client-id',
    isGoogleOAuthConfigured: true,
  };
  return new GoogleOAuthService(
    appConfig as unknown as AppConfigService,
    {} as HttpService,
  );
}

describe('GoogleOAuthService frontend redirect allowlist', () => {
  it.each([
    'https://review-mine.com/auth/callback',
    'https://www.review-mine.com/auth/callback',
  ])('allows own frontend %s', (url) => {
    expect(service().isAllowedFrontendRedirect(url)).toBe(true);
  });

  it.each([
    'https://evil.example/auth/callback',
    'https://review-mine.com.evil.example/auth/callback',
    'http://review-mine.com/auth/callback',
    'javascript:alert(1)',
    'not a url',
    '',
    undefined,
  ])('rejects %p', (url) => {
    expect(service().isAllowedFrontendRedirect(url)).toBe(false);
  });

  it('falls back to FRONTEND_URL for a foreign redirect_uri', () => {
    const svc = service();
    const { url } = svc.buildAuthorizationUrl('https://evil.example/steal');
    const state = new URL(url).searchParams.get('state')!;
    const stored = (
      svc as unknown as { states: Map<string, { frontendRedirect: string }> }
    ).states.get(state);
    expect(stored?.frontendRedirect).toBe(
      'https://review-mine.com/auth/callback',
    );
  });
});
