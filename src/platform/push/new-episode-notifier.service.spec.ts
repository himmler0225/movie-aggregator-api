import type { PrismaService } from '../../database/prisma.service';
import type { PushSubscriptionsRepository } from '../../database/repositories/push-subscriptions.repository';
import type { SeriesEpisodeStateRepository } from '../../database/repositories/series-episode-state.repository';
import type { RedisService } from '../../infra/redis';
import type { MoviesService } from '../../movies/movies.service';
import { NewEpisodeNotifierService } from './new-episode-notifier.service';
import type { PushService } from './push.service';

function setup(
  details: Record<string, { type?: string; episode_current?: string } | Error>,
) {
  const states = {
    findBySlugs: jest.fn().mockResolvedValue([
      {
        movieSlug: 'old-show',
        episodeCurrent: 'Tập 5',
        checkedAt: new Date(0),
      },
      {
        movieSlug: 'same-show',
        episodeCurrent: 'Tập 2',
        checkedAt: new Date(0),
      },
    ]),
    save: jest.fn().mockResolvedValue(undefined),
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
  const push = { enabled: true, sendToUsers: jest.fn().mockResolvedValue(1) };
  const service = new NewEpisodeNotifierService(
    {} as PrismaService,
    states as unknown as SeriesEpisodeStateRepository,
    {} as PushSubscriptionsRepository,
    movies as unknown as MoviesService,
    push as unknown as PushService,
    { getClient: () => null } as unknown as RedisService,
  );
  return { service, states, push };
}

describe('NewEpisodeNotifierService.checkSeries', () => {
  it('notifies followers only when a known series moved to a new episode', async () => {
    const { service, states, push } = setup({
      'old-show': { type: 'series', episode_current: 'Tập 6' },
      'same-show': { type: 'series', episode_current: 'Tập 2' },
      'new-show': { type: 'series', episode_current: 'Tập 1' },
      'a-film': { type: 'single', episode_current: 'Full' },
      broken: new Error('upstream down'),
    });
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
    // First sighting is recorded silently; films and failures are not stored.
    expect(states.save).toHaveBeenCalledWith('new-show', 'Tập 1');
    expect(states.save).not.toHaveBeenCalledWith('a-film', expect.anything());
    expect(states.save).not.toHaveBeenCalledWith('broken', expect.anything());
  });
});
