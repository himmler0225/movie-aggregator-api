import type { Profile } from '@prisma/client';
import { PROFILE_STATUS, ROLE } from '../../shared/constants';
import type { ProfileView } from '../types';

export function mapProfile(
  p: Pick<
    Profile,
    'id' | 'email' | 'fullName' | 'avatarUrl' | 'role' | 'createdAt'
  > &
    Partial<Pick<Profile, 'status'>>,
): ProfileView {
  return {
    id: p.id,
    username: p.fullName ?? p.email?.split('@')[0] ?? null,
    avatar_url: p.avatarUrl ?? null,
    plan:
      p.role === ROLE.PREMIUM || p.role === ROLE.ADMIN ? ROLE.PREMIUM : 'free',
    role: p.role,
    status: p.status ?? PROFILE_STATUS.APPROVED,
    created_at: p.createdAt?.toISOString(),
  };
}
