import type { RedisService } from '../infra/redis';
import { MovieCacheService } from './movie-cache.service';

function fakeRedis(status = 'ready') {
  const store = new Map<string, string>();
  const client = {
    status,
    get: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    set: jest.fn((k: string, v: string) => {
      store.set(k, v);

      return Promise.resolve('OK');
    }),
  };
  const redis = { getClient: () => client } as unknown as RedisService;

  return { redis, client, store };
}

describe('MovieCacheService', () => {
  it('loads upstream once and writes the result to Redis with the TTL', async () => {
    const { redis, client } = fakeRedis();
    const cache = new MovieCacheService(redis);
    const load = jest.fn(() => Promise.resolve({ a: 1 }));

    await expect(cache.getOrLoad('k', 180_000, load)).resolves.toEqual({
      a: 1,
    });
    await expect(cache.getOrLoad('k', 180_000, load)).resolves.toEqual({
      a: 1,
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(client.set).toHaveBeenCalledWith(
      'cf:movies:v1:k',
      '{"a":1}',
      'PX',
      180_000,
    );
  });

  it('serves a fresh process from Redis without hitting upstream', async () => {
    const { redis, store } = fakeRedis();

    store.set('cf:movies:v1:k', '{"b":2}');

    const load = jest.fn(() => Promise.resolve({ b: 0 }));

    await expect(
      new MovieCacheService(redis).getOrLoad('k', 1000, load),
    ).resolves.toEqual({ b: 2 });
    expect(load).not.toHaveBeenCalled();
  });

  it('falls back to upstream when Redis errors or is not ready', async () => {
    const broken = fakeRedis();

    broken.client.get.mockRejectedValueOnce(new Error('down'));

    await expect(
      new MovieCacheService(broken.redis).getOrLoad('k', 1000, () =>
        Promise.resolve(5),
      ),
    ).resolves.toBe(5);

    const offline = fakeRedis('reconnecting');

    await expect(
      new MovieCacheService(offline.redis).getOrLoad('k', 1000, () =>
        Promise.resolve(6),
      ),
    ).resolves.toBe(6);
    expect(offline.client.get).not.toHaveBeenCalled();
  });

  it('never caches upstream failures', async () => {
    const { redis, client } = fakeRedis();
    const cache = new MovieCacheService(redis);

    await expect(
      cache.getOrLoad('k', 1000, () => Promise.reject(new Error('502'))),
    ).rejects.toThrow('502');
    expect(client.set).not.toHaveBeenCalled();
    await expect(
      cache.getOrLoad('k', 1000, () => Promise.resolve(1)),
    ).resolves.toBe(1);
  });
});
