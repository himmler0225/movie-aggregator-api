const VN_OFFSET_MS = 7 * 3600_000;
const DAY_MS = 24 * 3600_000;

export interface WatchRow {
  movieSlug: string;
  movieName: string;
  thumbUrl: string | null;
  progressSec: number;
  durationSec: number;
  watchedAt: Date;
}

export interface WrappedStats {
  total_seconds: number;
  episodes: number;
  titles: number;
  top_titles: {
    slug: string;
    name: string;
    thumb_url: string | null;
    seconds: number;
    episodes: number;
  }[];
  /** Seconds watched per month (Jan..Dec). */
  by_month: number[];
  /** Episodes per hour of day (Vietnam time). */
  by_hour: number[];
  peak_hour: number | null;
  /** 0 = Sunday … 6 = Saturday. */
  peak_weekday: number | null;
  longest_streak_days: number;
  active_days: number;
}

const vn = (d: Date) => new Date(d.getTime() + VN_OFFSET_MS);

/** Year-in-review numbers from watch history rows (one row per episode). */
export function computeWrapped(rows: WatchRow[]): WrappedStats {
  const watched = rows.filter((r) => r.progressSec >= 60);
  const byTitle = new Map<string, WrappedStats['top_titles'][number]>();
  const byMonth = Array<number>(12).fill(0);
  const byHour = Array<number>(24).fill(0);
  const byWeekday = Array<number>(7).fill(0);
  const days = new Set<number>();
  let total = 0;

  for (const r of watched) {
    const seconds =
      r.durationSec > 0
        ? Math.min(r.progressSec, r.durationSec)
        : r.progressSec;
    total += seconds;
    const t = byTitle.get(r.movieSlug) ?? {
      slug: r.movieSlug,
      name: r.movieName,
      thumb_url: r.thumbUrl,
      seconds: 0,
      episodes: 0,
    };
    t.seconds += seconds;
    t.episodes += 1;
    byTitle.set(r.movieSlug, t);
    const local = vn(r.watchedAt);
    byMonth[local.getUTCMonth()] += seconds;
    byHour[local.getUTCHours()] += 1;
    byWeekday[local.getUTCDay()] += 1;
    days.add(Math.floor(local.getTime() / DAY_MS));
  }

  const sortedDays = [...days].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  for (let i = 0; i < sortedDays.length; i++) {
    run = i > 0 && sortedDays[i] === sortedDays[i - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const argmax = (arr: number[]) =>
    arr.some((v) => v > 0) ? arr.indexOf(Math.max(...arr)) : null;

  return {
    total_seconds: Math.round(total),
    episodes: watched.length,
    titles: byTitle.size,
    top_titles: [...byTitle.values()]
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5),
    by_month: byMonth.map(Math.round),
    by_hour: byHour,
    peak_hour: argmax(byHour),
    peak_weekday: argmax(byWeekday),
    longest_streak_days: longest,
    active_days: days.size,
  };
}
