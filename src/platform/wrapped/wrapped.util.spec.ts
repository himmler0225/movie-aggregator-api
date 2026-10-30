import { computeWrapped, type WatchRow } from './wrapped.util';

const row = (
  slug: string,
  iso: string,
  progress = 1200,
  duration = 2400,
): WatchRow => ({
  movieSlug: slug,
  movieName: slug.toUpperCase(),
  thumbUrl: null,
  progressSec: progress,
  durationSec: duration,
  watchedAt: new Date(`${iso}+07:00`),
});

describe('computeWrapped', () => {
  it('sums time, ranks titles and finds habits in Vietnam time', () => {
    const stats = computeWrapped([
      row('a', '2026-03-01T23:30'),
      row('a', '2026-03-02T23:10', 3000, 2400), // capped at duration
      row('a', '2026-03-03T22:00'),
      row('b', '2026-03-05T23:45'),
      row('c', '2026-07-01T10:00', 30), // < 1 min: ignored
    ]);
    expect(stats).toMatchObject({
      total_seconds: 1200 + 2400 + 1200 + 1200,
      episodes: 4,
      titles: 2,
      peak_hour: 23,
      longest_streak_days: 3,
      active_days: 4,
    });
    expect(stats.top_titles.map((t) => [t.slug, t.episodes])).toEqual([
      ['a', 3],
      ['b', 1],
    ]);
    expect(stats.by_month[2]).toBe(6000);
  });

  it('handles an empty year', () => {
    expect(computeWrapped([])).toMatchObject({
      total_seconds: 0,
      peak_hour: null,
      longest_streak_days: 0,
    });
  });
});
