import { Injectable } from '@nestjs/common';
import { SeriesEpisodeStateRepository } from '../../database/repositories/series-episode-state.repository';
import { MoviesService } from '../../movies/movies.service';
import type { MovieDetail } from '../../shared/types/movie.types';
import { SERIES_TYPES } from './new-episode-notifier.service';
import { predictRelease, type ReleasePattern } from './schedule.util';
import { TrackedSeriesService } from './tracked-series.service';

const MAX_SERIES = 60;
const FETCH_CONCURRENCY = 4;
/** Release history used for the pattern (older habits may have changed). */
const LOOKBACK_MS = 60 * 24 * 3600_000;

export interface ScheduleEntry {
  slug: string;
  name: string;
  thumb_url: string;
  poster_url: string;
  episode_current: string;
  episode_total: string | null;
  last_release_at: string | null;
  pattern: ReleasePattern | null;
}

/** The viewer's ongoing followed series with their learned release pattern. */
@Injectable()
export class ScheduleService {
  constructor(
    private readonly tracked: TrackedSeriesService,
    private readonly movies: MoviesService,
    private readonly states: SeriesEpisodeStateRepository,
  ) {}

  async forUser(userId: string): Promise<ScheduleEntry[]> {
    const slugs = [
      ...(await this.tracked.followersBySlug([userId])).keys(),
    ].slice(0, MAX_SERIES);
    const movies: MovieDetail[] = [];
    for (let i = 0; i < slugs.length; i += FETCH_CONCURRENCY) {
      const batch = await Promise.all(
        slugs.slice(i, i + FETCH_CONCURRENCY).map((slug) =>
          this.movies.getMovieDetail(slug).then(
            (r) => r.data.movie,
            () => null,
          ),
        ),
      );
      movies.push(...batch.filter((m): m is MovieDetail => m !== null));
    }
    const ongoing = movies.filter(
      (m) =>
        (!m.type || SERIES_TYPES.has(m.type)) &&
        m.status !== 'completed' &&
        !!m.episode_current?.trim(),
    );
    // Also a sighting: keeps release history flowing between job runs.
    await Promise.all(
      ongoing.map((m) =>
        this.states.observe(m.slug, m.episode_current!.trim()),
      ),
    );

    const events = await this.states.eventsFor(
      ongoing.map((m) => m.slug),
      new Date(Date.now() - LOOKBACK_MS),
    );
    const bySlug = new Map<string, Date[]>();
    for (const e of events) {
      const list = bySlug.get(e.movieSlug) ?? [];
      list.push(e.seenAt);
      bySlug.set(e.movieSlug, list);
    }

    return ongoing
      .map((m) => {
        const seen = bySlug.get(m.slug) ?? [];
        return {
          slug: m.slug,
          name: m.name,
          thumb_url: m.thumb_url,
          poster_url: m.poster_url,
          episode_current: m.episode_current!.trim(),
          episode_total: m.episode_total ?? null,
          last_release_at: seen.length
            ? seen[seen.length - 1].toISOString()
            : null,
          pattern: predictRelease(seen),
        };
      })
      .sort((a, b) =>
        (a.pattern?.nextAt ?? '~').localeCompare(b.pattern?.nextAt ?? '~'),
      );
  }
}
