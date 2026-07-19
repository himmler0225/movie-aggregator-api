import { Injectable } from '@nestjs/common';
import { MovieRatingsRepository } from '../../database/repositories/movie-ratings.repository';

@Injectable()
export class RatingsService {
  constructor(private readonly ratings: MovieRatingsRepository) {}

  async getUserRating(userId: string, movieSlug: string) {
    const row = await this.ratings.findUserRating(userId, movieSlug);
    return row?.score ?? null;
  }

  async getAggregate(movieSlug: string) {
    const rows = await this.ratings.findByMovieSlug(movieSlug);
    if (!rows.length) return { average: 0, count: 0 };
    const sum = rows.reduce((a, r) => a + r.score, 0);
    return {
      average: Math.round((sum / rows.length) * 10) / 10,
      count: rows.length,
    };
  }

  async upsert(userId: string, movieSlug: string, score: number) {
    await this.ratings.upsert(
      { userId_movieSlug: { userId, movieSlug } },
      {
        userId,
        movieSlug,
        score,
      },
      { score, updatedAt: new Date() },
    );
  }
}
