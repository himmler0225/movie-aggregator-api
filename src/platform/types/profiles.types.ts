export interface UpdateProfileInput {
  username?: string;
  avatar_url?: string;
  plan?: string;
}

export interface ProfileView {
  id: string;
  username: string | null;
  avatar_url: string | null;
  plan: string;
  role: string;
  created_at?: string;
}

export interface ListUsersOptions {
  query: string;
  sort: 'new' | 'name';
  filter: 'all' | 'free' | 'premium' | 'admin';
  page: number;
  pageSize: number;
}
