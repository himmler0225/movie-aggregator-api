import { Injectable } from '@nestjs/common';
import { FavoritesRepository } from '../../database/repositories/favorites.repository';
import { mapFavorite } from '../mappers';

import type { FavoriteInput } from '../types';

@Injectable()
export class FavoritesService {
  constructor(private readonly favorites: FavoritesRepository) {}

  async list(userId: string) {
    const rows = await this.favorites.findByUserId(userId);
    return rows.map(mapFavorite);
  }

  async slugMap(userId: string) {
    const rows = await this.favorites.findSlugMap(userId);
    return rows.map((r) => ({ id: r.id, movie_slug: r.movieSlug }));
  }

  async count(userId: string) {
    return this.favorites.count({ userId });
  }

  async add(userId: string, input: FavoriteInput) {
    const row = await this.favorites.create({
      userId,
      movieSlug: input.movieSlug,
      movieName: input.movieName,
      thumbUrl: input.thumbUrl ?? null,
    });
    return { id: row.id };
  }

  async addMany(userId: string, items: FavoriteInput[]) {
    if (!items.length) return { count: 0 };
    const count = await this.favorites.createMany(
      items.map((i) => ({
        userId,
        movieSlug: i.movieSlug,
        movieName: i.movieName,
        thumbUrl: i.thumbUrl ?? null,
      })),
      true,
    );
    return { count };
  }

  async remove(id: string) {
    await this.favorites.delete({ id });
    return { ok: true };
  }

  async removeBySlug(userId: string, movieSlug: string) {
    await this.favorites.deleteBySlug(userId, movieSlug);
    return { ok: true };
  }
}
