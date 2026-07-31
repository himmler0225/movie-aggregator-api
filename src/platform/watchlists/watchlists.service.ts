import { Injectable } from '@nestjs/common';
import { UserWatchlistsRepository } from '../../database/repositories/user-watchlists.repository';

@Injectable()
export class WatchlistsService {
  constructor(private readonly watchlists: UserWatchlistsRepository) {}
  async list(userId: string) {
    const rows = await this.watchlists.findByUserId(userId);
    return rows.map((r) => ({
      id: r.listKey,
      name: r.name,
      slugs: r.slugs,
      createdAt: r.createdAt.getTime(),
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
    if (!lists.length) return { ok: true };
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
}
