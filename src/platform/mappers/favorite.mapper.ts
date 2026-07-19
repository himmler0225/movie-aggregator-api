import type { Favorite } from '@prisma/client';
import type { FavoriteView } from '../types';

export function mapFavorite(
  f: Pick<
    Favorite,
    'id' | 'movieSlug' | 'movieName' | 'thumbUrl' | 'createdAt'
  >,
): FavoriteView {
  return {
    id: f.id,
    movie_slug: f.movieSlug,
    movie_name: f.movieName,
    thumb_url: f.thumbUrl,
    created_at: f.createdAt.toISOString(),
  };
}
