import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CommentsRepository } from '../../../database/repositories/comments.repository';
import { CommentsService } from '../../comments/comments.service';
import { QUERY_LIMITS } from '../../../shared/constants';
import type { CommentStats, ListCommentsOptions } from '../../types';

@Injectable()
export class AdminCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly comments: CommentsRepository,
    private readonly commentsService: CommentsService,
  ) {}
  async commentStats(): Promise<CommentStats> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const [today, week, month, topMovieRows] = await Promise.all([
      this.comments.count({ createdAt: { gte: todayStart } }),
      this.comments.count({ createdAt: { gte: weekAgo } }),
      this.comments.count({ createdAt: { gte: monthAgo } }),
      this.prisma.comment.groupBy({
        by: ['movieSlug'],
        _count: { _all: true },
        orderBy: { _count: { movieSlug: 'desc' } },
        take: 1,
      }),
    ]);
    const topMovie = topMovieRows[0]?.movieSlug ?? '—';
    return { today, week, month, topMovie };
  }
  async listComments(opts: ListCommentsOptions) {
    const where: Record<string, unknown> = {};
    if (opts.query)
      where.content = { contains: opts.query, mode: 'insensitive' };
    if (opts.movie) where.movieSlug = opts.movie;
    const orderBy =
      opts.sort === 'likes'
        ? { likes: 'desc' as const }
        : { createdAt: 'desc' as const };
    const result = await this.comments.paginate({
      where,
      orderBy,
      page: opts.page + 1,
      pageSize: opts.pageSize,
    });
    return {
      rows: await this.commentsService.mapCommentRows(result.data),
      total: result.total,
    };
  }
  async deleteComments(ids: string[]) {
    await this.comments.deleteMany({ id: { in: ids } });
    return { ok: true };
  }
  async recentComments(limit: number = QUERY_LIMITS.adminRecentComments) {
    const rows = await this.comments.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return this.commentsService.mapCommentRows(rows);
  }
}
