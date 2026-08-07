import { Injectable } from '@nestjs/common';
import { FavoritesRepository } from '../../../database/repositories/favorites.repository';
import { ProfilesRepository } from '../../../database/repositories/profiles.repository';
import { WatchHistoryRepository } from '../../../database/repositories/watch-history.repository';
import {
  PROFILE_STATUS,
  QUERY_LIMITS,
  ROLE,
  type Role,
} from '../../../shared/constants';
import { mapFavorite, mapProfile, mapWatchHistory } from '../../mappers';
import type { ListUsersOptions } from '../../types';

const ROLE_BY_FILTER: Partial<Record<ListUsersOptions['filter'], Role>> = {
  admin: ROLE.ADMIN,
  moderator: ROLE.MODERATOR,
  premium: ROLE.PREMIUM,
  free: ROLE.USER,
};

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly profiles: ProfilesRepository,
    private readonly watchHistory: WatchHistoryRepository,
    private readonly favorites: FavoritesRepository,
  ) {}
  async listUsers(opts: ListUsersOptions) {
    const where: Record<string, unknown> = {};
    if (opts.query) {
      where.OR = [
        { fullName: { contains: opts.query, mode: 'insensitive' } },
        { email: { contains: opts.query, mode: 'insensitive' } },
      ];
    }
    if (opts.filter === 'pending') {
      where.status = PROFILE_STATUS.PENDING;
    } else {
      const role = ROLE_BY_FILTER[opts.filter];
      if (role) where.role = role;
    }
    const orderBy =
      opts.sort === 'new'
        ? { createdAt: 'desc' as const }
        : { fullName: 'asc' as const };
    const result = await this.profiles.paginate({
      where,
      orderBy,
      page: opts.page + 1,
      pageSize: opts.pageSize,
    });
    return {
      rows: result.data.map(mapProfile),
      total: result.total,
    };
  }
  async updateUserRole(userId: string, role: string) {
    await this.profiles.update({ id: userId }, { role });
    return { ok: true };
  }
  async pendingUsers() {
    const rows = await this.profiles.findMany({
      where: { status: PROFILE_STATUS.PENDING },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapProfile);
  }
  async updateUserStatus(userId: string, status: 'approved' | 'rejected') {
    await this.profiles.update({ id: userId }, { status });
    return { ok: true };
  }
  async recentUsers(limit: number = QUERY_LIMITS.adminRecentUsers) {
    const rows = await this.profiles.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(mapProfile);
  }
  async userWatchHistory(
    userId: string,
    limit: number = QUERY_LIMITS.adminUserWatchHistory,
  ) {
    const rows = await this.watchHistory.findByUserId(userId, limit);
    return rows.map(mapWatchHistory);
  }
  async userFavorites(userId: string) {
    const rows = await this.favorites.findByUserId(userId);
    return rows.map(mapFavorite);
  }
}
