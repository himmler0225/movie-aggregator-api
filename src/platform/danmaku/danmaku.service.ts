import { Injectable, NotFoundException } from '@nestjs/common';
import { DanmakuCommentsRepository } from '../../database/repositories/danmaku-comments.repository';
import { ProfilesRepository } from '../../database/repositories/profiles.repository';
import { QUERY_LIMITS } from '../../shared/constants';
import { mapDanmaku } from '../mappers';
import type {
  CreateDanmakuInput,
  DanmakuView,
  ListDanmakuInput,
} from '../types';

@Injectable()
export class DanmakuService {
  constructor(
    private readonly danmaku: DanmakuCommentsRepository,
    private readonly profiles: ProfilesRepository,
  ) {}
  async list(input: ListDanmakuInput): Promise<DanmakuView[]> {
    const rows = await this.danmaku.findByEpisode(
      input.movieSlug,
      input.episodeName,
      { from: input.from, to: input.to },
      Math.min(
        input.limit ?? QUERY_LIMITS.danmakuDefault,
        QUERY_LIMITS.danmakuMax,
      ),
    );
    return rows.map(mapDanmaku);
  }
  async create(input: CreateDanmakuInput): Promise<DanmakuView> {
    let username = input.username ?? null;
    let avatarUrl = input.avatarUrl ?? null;
    if (!username) {
      const profile = await this.profiles.findById(input.userId);
      username = profile?.fullName ?? profile?.email?.split('@')[0] ?? username;
      avatarUrl = avatarUrl ?? profile?.avatarUrl ?? null;
    }
    const row = await this.danmaku.create({
      movieSlug: input.movieSlug,
      episodeName: input.episodeName,
      playbackTime: input.playbackTime,
      userId: input.userId,
      username,
      avatarUrl,
      content: input.content.trim(),
      roomId: input.roomId ?? null,
    });
    return mapDanmaku(row);
  }
  async remove(id: string, userId: string) {
    const row = await this.danmaku.findById(id);
    // Someone else's comment reads as missing rather than forbidden.
    if (!row || row.userId !== userId) {
      throw new NotFoundException('platform.danmakuNotFound');
    }
    await this.danmaku.delete({ id });
    return { error: null };
  }
}
