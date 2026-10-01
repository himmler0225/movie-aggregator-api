import type { DanmakuCommentsRepository } from '../../database/repositories/danmaku-comments.repository';
import type { MomentReactionsRepository } from '../../database/repositories/moment-reactions.repository';
import { buildHeatmap, MomentsService } from './moments.service';

function setup() {
  const reactions = {
    incrementMany: jest.fn((): Promise<void> => Promise.resolve()),
    findByEpisode: jest.fn(() => Promise.resolve([])),
  };
  const danmaku = { countByBucket: jest.fn(() => Promise.resolve([])) };
  const service = new MomentsService(
    reactions as unknown as MomentReactionsRepository,
    danmaku as unknown as DanmakuCommentsRepository,
  );
  return { service, reactions, danmaku };
}

describe('MomentsService', () => {
  it('batches reactions per bucket and emoji', async () => {
    const { service, reactions } = setup();
    const r = { movieSlug: 'm', episodeName: 'Tập 1', emoji: '🔥' };
    expect(service.record({ ...r, time: 12 })).toBe(true);
    expect(service.record({ ...r, time: 19.9 })).toBe(true);
    expect(service.record({ ...r, time: 20 })).toBe(true);
    expect(service.record({ ...r, emoji: '💩', time: 1 })).toBe(false);
    expect(service.record({ ...r, time: -1 })).toBe(false);
    expect(service.record({ ...r, time: Infinity })).toBe(false);
    await service.flush();
    expect(reactions.incrementMany).toHaveBeenCalledWith([
      { ...r, bucket: 1, count: 2 },
      { ...r, bucket: 2, count: 1 },
    ]);
    await service.flush();
    expect(reactions.incrementMany).toHaveBeenCalledTimes(1);
  });

  it('keeps counts when a flush fails', async () => {
    const { service, reactions } = setup();
    reactions.incrementMany.mockRejectedValueOnce(new Error('db down'));
    service.record({ movieSlug: 'm', episodeName: 'e', emoji: '🔥', time: 1 });
    await service.flush();
    service.record({ movieSlug: 'm', episodeName: 'e', emoji: '🔥', time: 1 });
    await service.flush();
    expect(reactions.incrementMany).toHaveBeenLastCalledWith([
      expect.objectContaining({ bucket: 0, count: 2 }),
    ]);
  });

  it('caches heatmaps briefly', async () => {
    const { service, reactions } = setup();
    await service.heatmap('m', 'e');
    await service.heatmap('m', 'e');
    expect(reactions.findByEpisode).toHaveBeenCalledTimes(1);
  });
});

describe('buildHeatmap', () => {
  it('scores buckets, weights danmaku and spreads hot moments', () => {
    const view = buildHeatmap(
      'm',
      'e',
      [
        { bucket: 1, emoji: '🔥', count: 10 },
        { bucket: 1, emoji: '😂', count: 3 },
        { bucket: 2, emoji: '😂', count: 8 },
        { bucket: 30, emoji: '😱', count: 4 },
      ],
      [{ bucket: 30, count: 2 }],
    );
    expect(view.bucket_seconds).toBe(10);
    expect(view.buckets).toEqual([
      { start: 10, reactions: 13, danmaku: 0, score: 1, top_emoji: '🔥' },
      { start: 20, reactions: 8, danmaku: 0, score: 0.615, top_emoji: '😂' },
      { start: 300, reactions: 4, danmaku: 2, score: 0.615, top_emoji: '😱' },
    ]);
    // 10s and 20s are within a minute of each other; only the stronger stays.
    expect(view.hot_moments.map((h) => h.start)).toEqual([10, 300]);
  });

  it('handles an episode with no activity', () => {
    const view = buildHeatmap('m', 'e', [], []);
    expect(view.buckets).toEqual([]);
    expect(view.hot_moments).toEqual([]);
  });
});
