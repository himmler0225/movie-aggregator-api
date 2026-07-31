import { Injectable } from '@nestjs/common';
import type { Comment } from '@prisma/client';
import { CommentsRepository } from '../../database/repositories/comments.repository';
import { ProfilesRepository } from '../../database/repositories/profiles.repository';
import { QUERY_LIMITS } from '../../shared/constants';
import type { CommentView, CreateCommentInput } from '../types';

@Injectable()
export class CommentsService {
  constructor(
    private readonly comments: CommentsRepository,
    private readonly profiles: ProfilesRepository,
  ) {}
  async mapCommentRows(rows: Comment[]): Promise<CommentView[]> {
    return this.mapRows(rows);
  }
  private async mapRows(rows: Comment[]): Promise<CommentView[]> {
    if (!rows.length) return [];
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const profileRows = await this.profiles.findByIds(userIds);
    const profileMap = new Map(profileRows.map((p) => [p.id, p]));
    return rows.map((row) => {
      const profile = profileMap.get(row.userId);
      return {
        id: row.id,
        user_id: row.userId,
        movie_slug: row.movieSlug,
        content: row.content,
        username: profile?.fullName ?? profile?.email?.split('@')[0] ?? null,
        avatar_url: null,
        likes: row.likes,
        is_spoiler: row.isSpoiler,
        episode_name: row.episodeName,
        created_at: row.createdAt.toISOString(),
      };
    });
  }
  async listByMovie(
    slug: string,
    limit: number = QUERY_LIMITS.commentsPerMovie,
  ) {
    const rows = await this.comments.findByMovieSlug(slug, limit);
    return this.mapRows(rows);
  }
  async create(input: CreateCommentInput) {
    await this.comments.create({
      userId: input.userId,
      movieSlug: input.movieSlug,
      content: input.content,
      likes: 0,
      isSpoiler: input.isSpoiler ?? false,
      episodeName: input.episodeName ?? null,
    });
  }
}
