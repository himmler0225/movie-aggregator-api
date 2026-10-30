import type { SeriesEpisodeStateRepository } from '../../database/repositories/series-episode-state.repository';
import type { RedisService } from '../../infra/redis';
import type { MoviesService } from '../../movies/movies.service';
import type { PushService } from '../push/push.service';
import { NewEpisodeNotifierService } from './new-episode-notifier.service';
import type { TrackedSeriesService } from './tracked-series.service';

type State = {
  movieSlug: string;
  episodeCurrent: string;
  notifiedEpisode: string | null;
  checkedAt: Date;
};

function setup(
  details: Record<string, { type?: string; episode_current?: string } | Error>,
  initial: Record<string, string | null>,
) {
  const db = new Map<string, State>(
    Object.entries(initial).map(([slug, notified]) => [
      slug,
      {
        movieSlug: slug,
        episodeCurrent: notified ?? '',
        notifiedEpisode: notified,
        checkedAt: new Date(0),
      },
    ]),
  );
  const states = {
    findBySlugs: jest.fn(() => Promise.resolve([...db.values()])),
    observe: jest.fn((slug: string, ep: string) => {
      const s = db.get(slug) ?? {
        movieSlug: slug,
        episodeCurrent: ep,
        notifiedEpisode: null,
        checkedAt: new Date(),
      };
      s.episodeCurrent = ep;
      db.set(slug, s);
      return Promise.resolve({ ...s });
    }),
    markNotified: jest.fn((slug: string, ep: string) => {
      db.get(slug)!.notifiedEpisode = ep;
      return Promise.resolve();
    }),
  };
  const movies = {
    getMovieDetail: jest.fn((slug: string) => {
      const d = details[slug];
      if (d instanceof Error) return Promise.reject(d);
      return Promise.resolve({
        data: {
          movie: { name: slug, slug, thumb_url: 't.jpg', poster_url: '', ...d },
        },
      });
    }),
  };
  const push = { sendToUsers: jest.fn().mockResolvedValue(1) };
  const service = new NewEpisodeNotifierService(
    states as unknown as SeriesEpisodeStateRepository,
    {} as TrackedSeriesService,
    movies as unknown as MoviesService,
    push as unknown as PushService,
    { getClient: () => null } as unknown as RedisService,
  );
  return { service, states, push, db };
}

describe('NewEpisodeNotifierService.checkSeries', () => {
  it('announces each new episode once; first sighting is a silent baseline', async () => {
    const { service, push, db } = setup(
      {
        'old-show': { type: 'series', episode_current: 'Tập 6' },
        'same-show': { type: 'series', episode_current: 'Tập 2' },
        'new-show': { type: 'series', episode_current: 'Tập 1' },
        'a-film': { type: 'single', episode_current: 'Full' },
        broken: new Error('upstream down'),
      },
      { 'old-show': 'Tập 5', 'same-show': 'Tập 2' },
    );
    const followers = new Map([
      ['old-show', new Set(['u1', 'u2'])],
      ['same-show', new Set(['u1'])],
      ['new-show', new Set(['u2'])],
      ['a-film', new Set(['u1'])],
      ['broken', new Set(['u1'])],
    ]);

    await expect(service.checkSeries(followers)).resolves.toBe(1);
    expect(push.sendToUsers).toHaveBeenCalledTimes(1);
    expect(push.sendToUsers).toHaveBeenCalledWith(
      ['u1', 'u2'],
      expect.objectContaining({ body: 'Đã có Tập 6', url: '/movie/old-show' }),
    );
    expect(db.get('new-show')?.notifiedEpisode).toBe('Tập 1');
    expect(db.has('a-film')).toBe(false);

    // Running again without changes sends nothing.
    await expect(service.checkSeries(followers)).resolves.toBe(0);
  });
});
