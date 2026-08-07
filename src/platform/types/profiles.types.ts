import type { Role } from '../../shared/constants';

export interface UpdateProfileInput {
  username?: string;
  avatar_url?: string;
}

export interface ProfileView {
  id: string;
  username: string | null;
  avatar_url: string | null;
  plan: string;
  role: string;
  status: string;
  created_at?: string;
}

export interface ListUsersOptions {
  query: string;
  sort: 'new' | 'name';
  filter: 'all' | 'free' | 'pending' | Exclude<Role, 'user'>;
  page: number;
  pageSize: number;
}
