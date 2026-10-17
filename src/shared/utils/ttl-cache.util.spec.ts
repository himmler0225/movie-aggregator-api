import { TtlCache } from './ttl-cache.util';

describe('TtlCache', () => {
  let now = 0;
  const clock = () => now;

  beforeEach(() => {
    now = 0;
  });

  it('serves a cached value until the TTL expires', async () => {
    const cache = new TtlCache<number>(10, clock);
    const load = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    await expect(cache.getOrLoad('k', 1000, load)).resolves.toBe(1);
    now = 999;
    await expect(cache.getOrLoad('k', 1000, load)).resolves.toBe(1);
    now = 1000;
    await expect(cache.getOrLoad('k', 1000, load)).resolves.toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight load between concurrent callers', async () => {
    const cache = new TtlCache<number>(10, clock);
    let resolve!: (v: number) => void;
    const load = jest.fn(() => new Promise<number>((r) => (resolve = r)));
    const a = cache.getOrLoad('k', 1000, load);
    const b = cache.getOrLoad('k', 1000, load);

    resolve(7);
    await expect(Promise.all([a, b])).resolves.toEqual([7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures', async () => {
    const cache = new TtlCache<number>(10, clock);
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(3);

    await expect(cache.getOrLoad('k', 1000, load)).rejects.toThrow('down');
    await expect(cache.getOrLoad('k', 1000, load)).resolves.toBe(3);
  });

  it('evicts the least recently used entry beyond the bound', async () => {
    const cache = new TtlCache<string>(2, clock);

    await cache.getOrLoad('a', 1000, () => Promise.resolve('a'));
    await cache.getOrLoad('b', 1000, () => Promise.resolve('b'));
    await cache.getOrLoad('a', 1000, () => Promise.resolve('x'));
    await cache.getOrLoad('c', 1000, () => Promise.resolve('c'));

    const reload = jest.fn(() => Promise.resolve('b2'));

    await expect(
      cache.getOrLoad('a', 1000, () => Promise.resolve('y')),
    ).resolves.toBe('a');
    await expect(cache.getOrLoad('b', 1000, reload)).resolves.toBe('b2');
    expect(cache.size).toBe(2);
  });
});
