import { UnauthorizedException } from '@nestjs/common';
import { PROFILE_STATUS } from '../../shared/constants';

/**
 * Admin approval gate shared by every way of getting (or using) a session:
 * password login, Google OAuth, refresh, and the JWT strategy.
 * A missing profile/status is treated as approved (pre-approval-gate accounts).
 */
export function assertAccountApproved(
  profile?: { status?: string | null } | null,
): void {
  if (!profile?.status || profile.status === PROFILE_STATUS.APPROVED) return;
  throw new UnauthorizedException(
    profile.status === PROFILE_STATUS.REJECTED
      ? 'auth.accountRejected'
      : 'auth.accountPending',
  );
}
