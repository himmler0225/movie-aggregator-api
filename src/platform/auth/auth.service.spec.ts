import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { AppConfigService } from '../../config';
import type { ProfilesRepository } from '../../database/repositories/profiles.repository';
import type { RefreshTokensRepository } from '../../database/repositories/refresh-tokens.repository';
import type { SupabaseService } from '../../database/supabase.service';
import { PROFILE_STATUS } from '../../shared/constants';
import { assertAccountApproved } from './account-status.util';
import { AuthService } from './auth.service';
import type { GoogleOAuthService } from './google-oauth.service';

const GOOGLE_USER = {
  email: 'new@gmail.com',
  name: 'New User',
  picture: 'https://example.com/a.png',
  email_verified: true,
};
const SUPABASE_USER = {
  id: 'user-1',
  email: GOOGLE_USER.email,
  user_metadata: {},
};

function profileRow(status: string) {
  return {
    id: SUPABASE_USER.id,
    email: GOOGLE_USER.email,
    fullName: GOOGLE_USER.name,
    avatarUrl: GOOGLE_USER.picture,
    role: 'user',
    status,
  };
}

function setup(opts: {
  existingUser: boolean;
  /** Profile row present before ensureProfile runs (e.g. inserted by the DB trigger). */
  existingProfile: ReturnType<typeof profileRow> | null;
}) {
  const supabase = {
    findUserByEmail: jest
      .fn()
      .mockResolvedValue(opts.existingUser ? SUPABASE_USER : null),
    createUser: jest
      .fn()
      .mockResolvedValue({ data: { user: SUPABASE_USER }, error: null }),
    updateUserById: jest.fn().mockResolvedValue({ error: null }),
  };
  const profiles = {
    findById: jest.fn().mockResolvedValue(opts.existingProfile),
    create: jest.fn((row: { status: string }) =>
      Promise.resolve(profileRow(row.status)),
    ),
    update: jest.fn((_where: unknown, data: { status?: string }) =>
      Promise.resolve(
        profileRow(data.status ?? opts.existingProfile?.status ?? ''),
      ),
    ),
  };
  const refreshTokens = { create: jest.fn().mockResolvedValue(undefined) };
  const jwt = { sign: jest.fn().mockReturnValue('access-token') };
  const googleOAuth = {
    exchangeCode: jest.fn().mockResolvedValue({
      googleUser: GOOGLE_USER,
      frontendRedirect: 'https://review-mine.com/auth/callback',
    }),
  };
  const service = new AuthService(
    supabase as unknown as SupabaseService,
    profiles as unknown as ProfilesRepository,
    refreshTokens as unknown as RefreshTokensRepository,
    jwt as unknown as JwtService,
    googleOAuth as unknown as GoogleOAuthService,
    {} as AppConfigService,
  );
  return { service, profiles };
}

describe('AuthService.handleGoogleCallback approval gate', () => {
  it('creates first-time Google users as pending and refuses a session', async () => {
    const { service, profiles } = setup({
      existingUser: false,
      existingProfile: null,
    });
    await expect(service.handleGoogleCallback('code', 'state')).rejects.toThrow(
      'auth.accountPending',
    );
    expect(profiles.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: PROFILE_STATUS.PENDING }),
    );
  });

  it('forces pending when the DB trigger already inserted an approved row', async () => {
    const { service, profiles } = setup({
      existingUser: false,
      existingProfile: profileRow(PROFILE_STATUS.APPROVED),
    });
    await expect(service.handleGoogleCallback('code', 'state')).rejects.toThrow(
      'auth.accountPending',
    );
    expect(profiles.update).toHaveBeenCalledWith(
      { id: SUPABASE_USER.id },
      { status: PROFILE_STATUS.PENDING },
    );
  });

  it('blocks an email-registered account that is still pending', async () => {
    const { service } = setup({
      existingUser: true,
      existingProfile: profileRow(PROFILE_STATUS.PENDING),
    });
    await expect(service.handleGoogleCallback('code', 'state')).rejects.toThrow(
      'auth.accountPending',
    );
  });

  it('blocks a rejected account', async () => {
    const { service } = setup({
      existingUser: true,
      existingProfile: profileRow(PROFILE_STATUS.REJECTED),
    });
    await expect(service.handleGoogleCallback('code', 'state')).rejects.toThrow(
      'auth.accountRejected',
    );
  });

  it('issues a session for an approved account', async () => {
    const { service } = setup({
      existingUser: true,
      existingProfile: profileRow(PROFILE_STATUS.APPROVED),
    });
    const { session } = await service.handleGoogleCallback('code', 'state');
    expect(session.access_token).toBe('access-token');
  });
});

describe('assertAccountApproved', () => {
  it.each([null, undefined, { status: null }, { status: 'approved' }])(
    'allows %p',
    (profile) => {
      expect(() => assertAccountApproved(profile)).not.toThrow();
    },
  );

  it.each([
    ['pending', 'auth.accountPending'],
    ['rejected', 'auth.accountRejected'],
  ])('rejects %s with %s', (status, key) => {
    expect(() => assertAccountApproved({ status })).toThrow(
      new UnauthorizedException(key),
    );
  });
});
