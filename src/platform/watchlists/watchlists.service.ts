import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ProfilesRepository } from '../../database/repositories/profiles.repository';
import { UserWatchlistsRepository } from '../../database/repositories/user-watchlists.repository';

function newShareId() {
  return randomBytes(8).toString('base64url');
}

@Injectable()
export class WatchlistsService {
  constructor(
    private readonly watchlists: UserWatchlistsRepository,
    private readonly profiles: ProfilesRepository,
  ) {}
  async list(userId: string) {
    const rows = await this.watchlists.findByUserId(userId);
    return rows.map((r) => ({
      id: r.listKey,
      name: r.name,
      slugs: r.slugs,
      createdAt: r.createdAt.getTime(),
      isPublic: r.isPublic,
      shareId: r.isPublic ? r.shareId : null,
    }));
  }
  async saveAll(
    userId: string,
    lists: {
      id: string;
      name: string;
      slugs: string[];
      createdAt: number;
    }[],
  ) {
    await this.watchlists.upsertMany(
      userId,
      lists.map((list) => ({
        id: list.id,
        name: list.name,
        slugs: list.slugs,
        createdAt: new Date(list.createdAt),
      })),
    );
    return { ok: true };
  }
  /** Turns public sharing of one list on/off; the link id stays the same across toggles. */
  async setSharing(userId: string, listKey: string, isPublic: boolean) {
    const rows = await this.watchlists.findByUserId(userId);
    const list = rows.find((r) => r.listKey === listKey);
    if (!list) throw new NotFoundException('platform.watchlistNotFound');
    const shareId = list.shareId ?? (isPublic ? newShareId() : undefined);
    const updated = await this.watchlists.setSharing(
      userId,
      listKey,
      isPublic,
      shareId,
    );
    return {
      isPublic: updated.isPublic,
      shareId: updated.isPublic ? updated.shareId : null,
    };
  }
  async getShared(shareId: string) {
    const list = await this.watchlists.findByShareId(shareId);
    if (!list) throw new NotFoundException('platform.watchlistNotFound');
    const owner = await this.profiles.findById(list.userId);
    return {
      name: list.name,
      slugs: list.slugs,
      createdAt: list.createdAt.getTime(),
      owner: {
        name: owner?.fullName ?? owner?.email?.split('@')[0] ?? null,
        avatarUrl: owner?.avatarUrl ?? null,
      },
    };
  }
}
