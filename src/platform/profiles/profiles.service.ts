import { Injectable } from '@nestjs/common';
import { ProfilesRepository } from '../../database/repositories/profiles.repository';
import { mapProfile } from '../mappers';

import type { UpdateProfileInput } from '../types';

@Injectable()
export class ProfilesService {
  constructor(private readonly profiles: ProfilesRepository) {}

  async getProfile(userId: string) {
    const p = await this.profiles.findById(userId);
    return p ? mapProfile(p) : null;
  }

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const updated = await this.profiles.update(
      { id: userId },
      {
        fullName: data.username,
        avatarUrl: data.avatar_url,
      },
    );
    return mapProfile(updated);
  }

  async ensureOAuthProfile(
    userId: string,
    meta: Record<string, unknown>,
    email?: string | null,
  ) {
    const existing = await this.profiles.findById(userId);
    if (existing) return mapProfile(existing);

    const fullName =
      (meta.full_name as string | undefined) ??
      (meta.name as string | undefined) ??
      email?.split('@')[0] ??
      'User';

    const avatarUrl =
      (meta.avatar_url as string | undefined) ??
      (meta.picture as string | undefined) ??
      null;

    const created = await this.profiles.create({
      id: userId,
      email: email ?? null,
      fullName,
      avatarUrl,
      role: 'user',
    });
    return mapProfile(created);
  }
}
