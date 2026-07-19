export interface MetricChange {
  now: number;
  change: number;
}

export interface UsersChange {
  change: number;
}

export interface DashboardStats {
  totalUsers: number;
  pageViews: MetricChange;
  watch: MetricChange;
  rooms: MetricChange;
  users: UsersChange;
}

export interface DashboardLinePoint {
  date: string;
  views: number;
  watches: number;
}

export interface TopMovieStat {
  slug: string;
  name: string;
  views: number;
  total: number;
  avg: number;
}

export interface TopKeywordStat {
  keyword: string;
  searches: number;
  clicks: number;
  ctr: number;
}

export interface AdminRoomRow {
  id: string;
  code: string;
  host_id: string;
  movie_name: string | null;
  movie_slug: string;
  created_at: string;
  expires_at: string;
}

export interface CommentStats {
  today: number;
  week: number;
  month: number;
  topMovie: string | null;
}
