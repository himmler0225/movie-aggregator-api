export interface CreateCommentInput {
  userId: string;
  movieSlug: string;
  content: string;
  isSpoiler?: boolean;
  episodeName?: string | null;
}

export interface CommentView {
  id: string;
  user_id: string;
  movie_slug: string;
  content: string;
  username: string | null;
  avatar_url: string | null;
  likes: number;
  is_spoiler: boolean;
  episode_name: string | null;
  created_at: string;
}

export interface ListCommentsOptions {
  query: string;
  movie: string;
  sort: 'new' | 'likes';
  page: number;
  pageSize: number;
}
