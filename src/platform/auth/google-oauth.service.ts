import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { randomBytes } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../config';
import {
  GOOGLE_OAUTH_CALLBACK_PATH,
  GOOGLE_OAUTH_URLS,
  FRONTEND_AUTH_CALLBACK_PATH,
  OAUTH_STATE_BYTES,
  OAUTH_STATE_TTL_MS,
} from '../../shared/constants';
import type { GoogleTokenResponse, GoogleUserInfo, OAuthState } from '../types';

@Injectable()
export class GoogleOAuthService {
  private readonly states = new Map<string, OAuthState>();
  private readonly stateTtlMs = OAUTH_STATE_TTL_MS;
  constructor(
    private readonly appConfig: AppConfigService,
    private readonly http: HttpService,
  ) {}
  isConfigured(): boolean {
    return this.appConfig.isGoogleOAuthConfigured;
  }
  private cleanupStates() {
    const now = Date.now();
    for (const [key, value] of this.states) {
      if (value.expiresAt < now) this.states.delete(key);
    }
  }
  buildAuthorizationUrl(frontendRedirect?: string): {
    url: string;
  } {
    if (!this.isConfigured()) {
      throw new BadRequestException('auth.oauthNotConfigured');
    }
    this.cleanupStates();
    const state = randomBytes(OAUTH_STATE_BYTES).toString('hex');
    const redirect =
      frontendRedirect?.trim() ||
      `${this.appConfig.frontendUrl}${FRONTEND_AUTH_CALLBACK_PATH}`;
    this.states.set(state, {
      frontendRedirect: redirect,
      expiresAt: Date.now() + this.stateTtlMs,
    });
    const callbackUrl = `${this.appConfig.apiPublicUrl}${GOOGLE_OAUTH_CALLBACK_PATH}`;
    const params = new URLSearchParams({
      client_id: this.appConfig.googleClientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });
    return { url: `${GOOGLE_OAUTH_URLS.authorize}?${params.toString()}` };
  }
  async exchangeCode(
    code: string,
    state: string,
  ): Promise<{
    googleUser: GoogleUserInfo;
    frontendRedirect: string;
  }> {
    if (!this.isConfigured()) {
      throw new BadRequestException('auth.oauthNotConfigured');
    }
    const stored = this.states.get(state);
    this.states.delete(state);
    if (!stored || stored.expiresAt < Date.now()) {
      throw new UnauthorizedException('auth.oauthStateInvalid');
    }
    const callbackUrl = `${this.appConfig.apiPublicUrl}${GOOGLE_OAUTH_CALLBACK_PATH}`;
    const body = new URLSearchParams({
      code,
      client_id: this.appConfig.googleClientId,
      client_secret: this.appConfig.googleClientSecret,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code',
    });
    const tokenRes = await firstValueFrom(
      this.http.post<GoogleTokenResponse>(
        GOOGLE_OAUTH_URLS.token,
        body.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          validateStatus: () => true,
        },
      ),
    );
    if (tokenRes.status < 200 || tokenRes.status >= 300) {
      throw new UnauthorizedException('auth.oauthExchangeFailed');
    }
    const tokens = tokenRes.data;
    const userRes = await firstValueFrom(
      this.http.get<GoogleUserInfo>(GOOGLE_OAUTH_URLS.userInfo, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        validateStatus: () => true,
      }),
    );
    if (userRes.status < 200 || userRes.status >= 300) {
      throw new UnauthorizedException('auth.oauthProfileFailed');
    }
    const googleUser = userRes.data;
    if (!googleUser.email) {
      throw new UnauthorizedException('auth.oauthNoEmail');
    }
    return { googleUser, frontendRedirect: stored.frontendRedirect };
  }
}
