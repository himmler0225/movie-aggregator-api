import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Profile } from '@prisma/client';
import { AppConfigService } from '../../config';
import { ProfilesRepository } from '../../database/repositories/profiles.repository';
import { SupabaseService } from '../../database/supabase.service';
import { SESSION_TOKEN_TTL_SECONDS } from '../../shared/constants';
import type { SessionResponse } from '../types';
import { GoogleOAuthService } from './google-oauth.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly profiles: ProfilesRepository,
    private readonly jwt: JwtService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly appConfig: AppConfigService,
  ) {}

  private buildSession(
    user: { id: string; email: string },
    profile?: Profile | null,
    supabaseMeta?: Record<string, unknown>,
  ): SessionResponse {
    const expiresIn = SESSION_TOKEN_TTL_SECONDS;
    const access_token = this.jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn },
    );
    const avatarUrl =
      profile?.avatarUrl ??
      (supabaseMeta?.avatar_url as string | undefined) ??
      (supabaseMeta?.picture as string | undefined) ??
      undefined;

    return {
      access_token,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: {
          full_name: profile?.fullName ?? (supabaseMeta?.full_name as string | undefined),
          username:
            profile?.fullName ??
            (supabaseMeta?.username as string | undefined) ??
            profile?.email?.split('@')[0],
          avatar_url: avatarUrl,
          picture: avatarUrl,
        },
      },
    };
  }

  private async ensureProfile(
    userId: string,
    email: string,
    fullName?: string | null,
    avatarUrl?: string | null,
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
        role: 'user',
      });
    } catch {
      const again = await this.profiles.findById(userId);
      if (again) return again;
      throw new BadRequestException('auth.profileEnsureFailed');
    }
  }

  private sessionFromSupabaseUser(user: SupabaseUser, profile?: Profile | null) {
    if (!user.email) throw new BadRequestException('auth.userNoEmail');
    return this.buildSession({ id: user.id, email: user.email }, profile, user.user_metadata);
  }

  async register(
    email: string,
    password: string,
    username: string,
  ): Promise<SessionResponse> {
    const existing = await this.supabase.findUserByEmail(email);
    if (existing) throw new ConflictException('auth.emailAlreadyRegistered');

    const { data, error } = await this.supabase.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, full_name: username },
    });

    if (error || !data.user) {
      throw new BadRequestException(error?.message ?? 'auth.registrationFailed');
    }

    const profile = await this.ensureProfile(data.user.id, email, username.trim());
    return this.sessionFromSupabaseUser(data.user, profile);
  }

  async login(email: string, password: string): Promise<SessionResponse> {
    const { data, error } = await this.supabase.signInWithPassword(email, password);
    if (error || !data.user?.email) {
      throw new UnauthorizedException('auth.invalidCredentials');
    }

    const profile = await this.profiles.findById(data.user.id);
    return this.sessionFromSupabaseUser(data.user, profile);
  }

  async getSession(userId: string): Promise<SessionResponse | null> {
    const { data, error } = await this.supabase.getUserById(userId);
    if (error || !data.user?.email) return null;

    const profile = await this.profiles.findById(userId);
    return this.sessionFromSupabaseUser(data.user, profile);
  }

  async updatePassword(userId: string, password: string): Promise<void> {
    if (password.length < 6) throw new BadRequestException('auth.passwordTooShort');
    const { error } = await this.supabase.updateUserById(userId, { password });
    if (error) throw new BadRequestException(error.message);
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
    const { googleUser, frontendRedirect } = await this.googleOAuth.exchangeCode(code, state);

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

    const session = this.sessionFromSupabaseUser(user, profile);
    return { session, frontendRedirect };
  }
}
