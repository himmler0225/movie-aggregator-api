import { Injectable } from '@nestjs/common';
import { Comment } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';
import { QUERY_LIMITS } from '../../shared/constants';

@Injectable()
export class CommentsRepository extends BaseRepository<Comment> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.comment);
  }
  findByMovieSlug(slug: string, limit: number = QUERY_LIMITS.commentsPerMovie) {
    return this.findMany({
      where: { movieSlug: slug },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
