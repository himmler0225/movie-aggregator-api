import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Profile } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AppConfigService } from '../../config';
import { ProfilesRepository } from '../../database/repositories/profiles.repository';
import { RefreshTokensRepository } from '../../database/repositories/refresh-tokens.repository';
import { SupabaseService } from '../../database/supabase.service';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  PROFILE_STATUS,
  REFRESH_TOKEN_TTL_SECONDS,
  ROLE,
} from '../../shared/constants';
import type { SessionResponse } from '../types';
import { hashRefreshToken } from './auth-refresh.util';
import { GoogleOAuthService } from './google-oauth.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly profiles: ProfilesRepository,
    private readonly refreshTokens: RefreshTokensRepository,
    private readonly jwt: JwtService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly appConfig: AppConfigService,
  ) {}

  private async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString('base64url');
    const tokenHash = hashRefreshToken(raw);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    await this.refreshTokens.create({
      userId,
      tokenHash,
      expiresAt,
    });
    return raw;
  }

  private async buildSession(
    user: { id: string; email: string },
    profile?: Profile | null,
    supabaseMeta?: Record<string, unknown>,
    opts: { issueRefresh?: boolean } = { issueRefresh: true },
  ): Promise<SessionResponse> {
    const expiresIn = ACCESS_TOKEN_TTL_SECONDS;
    const access_token = this.jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn },
    );
    const avatarUrl =
      profile?.avatarUrl ??
      (supabaseMeta?.avatar_url as string | undefined) ??
      (supabaseMeta?.picture as string | undefined) ??
      undefined;

    const session: SessionResponse = {
      access_token,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: {
          full_name: profile?.fullName ?? supabaseMeta?.full_name,
          username:
            profile?.fullName ??
            supabaseMeta?.username ??
            profile?.email?.split('@')[0],
          avatar_url: avatarUrl,
          picture: avatarUrl,
        },
      },
    };

    if (opts.issueRefresh !== false) {
      session.refresh_token = await this.issueRefreshToken(user.id);
    }
    return session;
  }

  private async ensureProfile(
    userId: string,
    email: string,
    fullName?: string | null,
    avatarUrl?: string | null,
    status: string = PROFILE_STATUS.APPROVED,
  ): Promise<Profile> {
    const existing = await this.profiles.findById(userId);
    if (existing) {
      const needsUpdate =
        (fullName && fullName !== existing.fullName) ||
        (email && email !== existing.email) ||
        (avatarUrl && avatarUrl !== existing.avatarUrl);
      if (needsUpdate) {
        return this.profiles.update(
          { id: userId },
          {
            fullName: fullName ?? existing.fullName ?? undefined,
            email: email ?? existing.email ?? undefined,
            avatarUrl: avatarUrl ?? existing.avatarUrl ?? undefined,
          },
        );
      }
      return existing;
    }
    try {
      return await this.profiles.create({
        id: userId,
        email,
        fullName: fullName ?? email.split('@')[0] ?? 'User',
        avatarUrl: avatarUrl ?? null,
        role: ROLE.USER,
        status,
      });
    } catch {
      const again = await this.profiles.findById(userId);
      if (again) return again;
      throw new BadRequestException('auth.profileEnsureFailed');
    }
  }

  private sessionFromSupabaseUser(
    user: SupabaseUser,
    profile?: Profile | null,
    opts?: { issueRefresh?: boolean },
  ) {
    if (!user.email) throw new BadRequestException('auth.userNoEmail');
    return this.buildSession(
      { id: user.id, email: user.email },
      profile,
      user.user_metadata,
      opts,
    );
  }

  async register(
    email: string,
    password: string,
    username: string,
  ): Promise<{ pending: true }> {
    const existing = await this.supabase.findUserByEmail(email);
    if (existing) throw new ConflictException('auth.emailAlreadyRegistered');
    const { data, error } = await this.supabase.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, full_name: username },
    });
    if (error || !data.user) {
      throw new BadRequestException(
        error?.message ?? 'auth.registrationFailed',
      );
    }
    await this.ensureProfile(
      data.user.id,
      email,
      username.trim(),
      null,
      PROFILE_STATUS.PENDING,
    );
    // Supabase's `on_auth_user_created` DB trigger inserts a profiles row
    // (defaulting to status=approved) as soon as the auth user is created,
    // before this request runs — so ensureProfile() above sees an existing
    // row and won't have applied the pending status. Force it explicitly.
    await this.profiles.update(
      { id: data.user.id },
      { status: PROFILE_STATUS.PENDING },
    );
    return { pending: true };
  }

  async login(email: string, password: string): Promise<SessionResponse> {
    const { data, error } = await this.supabase.signInWithPassword(
      email,
      password,
    );
    if (error || !data.user?.email) {
      throw new UnauthorizedException('auth.invalidCredentials');
    }
    const profile = await this.profiles.findById(data.user.id);
    if (profile?.status === PROFILE_STATUS.PENDING) {
      throw new UnauthorizedException('auth.accountPending');
    }
    if (profile?.status === PROFILE_STATUS.REJECTED) {
      throw new UnauthorizedException('auth.accountRejected');
    }
    return this.sessionFromSupabaseUser(data.user, profile);
  }

  async getSession(
    userId: string,
    opts?: { issueRefresh?: boolean },
  ): Promise<SessionResponse | null> {
    const { data, error } = await this.supabase.getUserById(userId);
    if (error || !data.user?.email) return null;
    const profile = await this.profiles.findById(userId);
    if (profile?.status && profile.status !== PROFILE_STATUS.APPROVED) {
      return null;
    }
    return this.sessionFromSupabaseUser(data.user, profile, {
      issueRefresh: opts?.issueRefresh === true,
    });
  }

  async refresh(refreshToken: string): Promise<SessionResponse> {
    if (!refreshToken?.trim()) {
      throw new UnauthorizedException('auth.invalidRefreshToken');
    }
    const tokenHash = hashRefreshToken(refreshToken.trim());
    const stored = await this.refreshTokens.findValidByHash(tokenHash);
    if (!stored) {
      throw new UnauthorizedException('auth.invalidRefreshToken');
    }
    await this.refreshTokens.revokeByHash(tokenHash);

    const { data, error } = await this.supabase.getUserById(stored.userId);
    if (error || !data.user?.email) {
      throw new UnauthorizedException('auth.invalidRefreshToken');
    }
    const profile = await this.profiles.findById(stored.userId);
    if (profile?.status && profile.status !== PROFILE_STATUS.APPROVED) {
      throw new UnauthorizedException('auth.accountPending');
    }
    return this.sessionFromSupabaseUser(data.user, profile, {
      issueRefresh: true,
    });
  }

  async logout(userId: string, refreshToken?: string): Promise<{ ok: true }> {
    if (refreshToken?.trim()) {
      await this.refreshTokens.revokeByHash(
        hashRefreshToken(refreshToken.trim()),
      );
    } else {
      await this.refreshTokens.revokeAllForUser(userId);
    }
    return { ok: true };
  }

  async updatePassword(userId: string, password: string): Promise<void> {
    if (password.length < 6)
      throw new BadRequestException('auth.passwordTooShort');
    const { error } = await this.supabase.updateUserById(userId, { password });
    if (error) throw new BadRequestException(error.message);
    await this.refreshTokens.revokeAllForUser(userId);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await this.supabase.resetPasswordForEmail(
      email,
      `${this.appConfig.frontendUrl}/reset-password`,
    );
    if (error) throw new BadRequestException(error.message);
  }

  getGoogleAuthUrl(frontendRedirect?: string) {
    return this.googleOAuth.buildAuthorizationUrl(frontendRedirect);
  }

  async handleGoogleCallback(
    code: string,
    state: string,
  ): Promise<{ session: SessionResponse; frontendRedirect: string }> {
    const { googleUser, frontendRedirect } =
      await this.googleOAuth.exchangeCode(code, state);
    let user = await this.supabase.findUserByEmail(googleUser.email);
    if (!user) {
      const { data, error } = await this.supabase.createUser({
        email: googleUser.email,
        email_confirm: googleUser.email_verified ?? true,
        user_metadata: {
          full_name: googleUser.name,
          name: googleUser.name,
          avatar_url: googleUser.picture,
          picture: googleUser.picture,
        },
      });
      if (error || !data.user) {
        const existing = await this.supabase.findUserByEmail(googleUser.email);
        if (!existing) {
          throw new UnauthorizedException(
            error?.message ?? 'auth.googleUserCreateFailed',
          );
        }
        user = existing;
      } else {
        user = data.user;
      }
    } else if (googleUser.picture || googleUser.name) {
      await this.supabase.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          full_name: googleUser.name ?? user.user_metadata?.full_name,
          avatar_url: googleUser.picture ?? user.user_metadata?.avatar_url,
          picture: googleUser.picture ?? user.user_metadata?.picture,
        },
      });
    }
    const profile = await this.ensureProfile(
      user.id,
      googleUser.email,
      googleUser.name ??
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split('@')[0],
      googleUser.picture ??
        (user.user_metadata?.avatar_url as string | undefined) ??
        (user.user_metadata?.picture as string | undefined) ??
        null,
    );
    const session = await this.sessionFromSupabaseUser(user, profile);
    return { session, frontendRedirect };
  }
}
