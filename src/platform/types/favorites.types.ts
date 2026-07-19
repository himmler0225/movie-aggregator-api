export interface FavoriteInput {
  movieSlug: string;
  movieName: string;
  thumbUrl?: string | null;
}

export interface FavoriteView {
  id: string;
  movie_slug: string;
  movie_name: string;
  thumb_url: string | null;
  created_at: string;
}
