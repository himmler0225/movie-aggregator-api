import { Injectable } from '@nestjs/common';
import { MovieRating } from '@prisma/client';
import { BaseRepository } from '../base/base.repository';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MovieRatingsRepository extends BaseRepository<MovieRating> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.movieRating);
  }
  findByMovieSlug(movieSlug: string) {
    return this.findMany({ where: { movieSlug }, select: { score: true } });
  }
  findUserRating(userId: string, movieSlug: string) {
    return this.findOne({ userId, movieSlug });
  }
}
