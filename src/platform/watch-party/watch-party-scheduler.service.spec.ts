import type { RoomRemindersRepository } from '../../database/repositories/room-reminders.repository';
import type { WatchRoomsRepository } from '../../database/repositories/watch-rooms.repository';
import type { RedisService } from '../../infra/redis';
import type { WatchPartyGateway } from './watch-party.gateway';
import { WatchPartySchedulerService } from './watch-party-scheduler.service';
import { WatchPartyStore } from './watch-party.store';

const NOW = new Date('2026-10-01T12:00:00Z');

function room(scheduledAt: Date) {
  return {
    id: 'room-1',
    code: 'AAAA',
    hostId: 'host-1',
    coHostIds: [],
    controlMode: 'host',
    waitForBuffering: true,
    episodeQueue: [],
    autoNext: true,
    scheduledAt,
    title: 'Movie night',
    movieSlug: 'movie',
    movieName: 'Movie',
    thumbUrl: null,
    episodeName: 'Tập 1',
    serverIndex: 0,
    playbackTime: 0,
    isPlaying: false,
    isPrivate: false,
    pin: null,
    createdAt: NOW,
    expiresAt: new Date(NOW.getTime() + 6 * 3600_000),
  };
}

function setup() {
  const claimed = new Set<string>();
  const reminders = {
    findDue: jest.fn(),
    claim: jest.fn((id: string) => {
      if (claimed.has(id)) return Promise.resolve(false);
      claimed.add(id);
      return Promise.resolve(true);
    }),
  };
  const rooms = { findMany: jest.fn(() => Promise.resolve([])) };
  const gateway = { emitToUser: jest.fn(), emitRoomStarting: jest.fn() };
  const store = new WatchPartyStore({
    getClient: () => null,
  } as unknown as RedisService);
  const scheduler = new WatchPartySchedulerService(
    rooms as unknown as WatchRoomsRepository,
    reminders as unknown as RoomRemindersRepository,
    gateway as unknown as WatchPartyGateway,
    store,
  );
  return { scheduler, reminders, rooms, gateway };
}

describe('WatchPartySchedulerService', () => {
  it('sends each due reminder once with the time left', async () => {
    const { scheduler, reminders, gateway } = setup();
    const due = [
      {
        id: 'rem-1',
        userId: 'user-1',
        room: room(new Date(NOW.getTime() + 4 * 60_000)),
      },
    ];
    reminders.findDue.mockResolvedValue(due);
    await scheduler.tick(NOW);
    await scheduler.tick(NOW);
    expect(gateway.emitToUser).toHaveBeenCalledTimes(1);
    expect(gateway.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'reminder:due',
      expect.objectContaining({
        starts_in_seconds: 240,
        room: expect.objectContaining({ code: 'AAAA' }) as unknown,
      }),
    );
    const [from, to] = reminders.findDue.mock.calls[0] as [Date, Date];
    expect(to.getTime() - NOW.getTime()).toBe(5 * 60_000);
    expect(NOW.getTime() - from.getTime()).toBe(10 * 60_000);
  });

  it('announces a room start once', async () => {
    const { scheduler, reminders, rooms, gateway } = setup();
    reminders.findDue.mockResolvedValue([]);
    rooms.findMany.mockResolvedValue([room(NOW)] as never);
    await scheduler.tick(NOW);
    await scheduler.tick(new Date(NOW.getTime() + 30_000));
    expect(gateway.emitRoomStarting).toHaveBeenCalledTimes(1);
    expect(gateway.emitRoomStarting).toHaveBeenCalledWith('AAAA', {
      scheduled_at: NOW.toISOString(),
      server_time: NOW.toISOString(),
    });
  });

  it('survives a failing tick', async () => {
    const { scheduler, reminders } = setup();
    reminders.findDue.mockRejectedValueOnce(new Error('db down'));
    await expect(scheduler.tick(NOW)).resolves.toBeUndefined();
  });
});
