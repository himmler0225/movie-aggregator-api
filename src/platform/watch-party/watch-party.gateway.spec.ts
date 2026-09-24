import type { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import type { AppConfigService } from '../../config';
import type { WatchRoomsRepository } from '../../database/repositories/watch-rooms.repository';
import type { RedisService } from '../../infra/redis';
import type { GatewaySocketData, PlaybackStateMsg } from '../types';
import { WatchPartyGateway } from './watch-party.gateway';

const HOST_ID = 'host-1';

function setup() {
  const rooms = {
    findByCode: jest.fn((code: string) =>
      Promise.resolve(
        code === 'AAAA' || code === 'BBBB'
          ? {
              id: `id-${code}`,
              code,
              hostId: HOST_ID,
              playbackTime: 0,
              isPlaying: false,
            }
          : null,
      ),
    ),
    findById: jest.fn(() => Promise.resolve({ isPlaying: false })),
    updateMany: jest.fn(() => Promise.resolve(1)),
  };
  const redis = { getClient: () => null };
  const gateway = new WatchPartyGateway(
    {} as JwtService,
    {} as AppConfigService,
    redis as unknown as RedisService,
    rooms as unknown as WatchRoomsRepository,
  );
  const emitted: { room: string; event: string; payload: unknown }[] = [];
  gateway.server = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) =>
        emitted.push({ room, event, payload }),
    }),
  } as unknown as Server;
  const playbackEvents = () =>
    emitted
      .filter((e) => e.event === 'playback:event')
      .map((e) => e.payload as PlaybackStateMsg);
  return { gateway, rooms, playbackEvents };
}

function socket(userId: string, roomCode: string, roomId: string): Socket {
  const data: GatewaySocketData = {
    userId,
    roomCode,
    roomId,
    isHost: userId === HOST_ID,
  };
  return { id: `sock-${userId}`, data } as unknown as Socket;
}

describe('WatchPartyGateway playback', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('rejects events for a room other than the one the host joined', async () => {
    const { gateway, rooms } = setup();
    const result = await gateway.handlePlaybackEvent(
      socket(HOST_ID, 'AAAA', 'id-AAAA'),
      { roomCode: 'BBBB', type: 'PAUSE', time: 0 },
    );
    expect(result).toEqual({ ok: false });
    expect(rooms.updateMany).not.toHaveBeenCalled();
  });

  it('rejects unknown types and non-finite or negative times', async () => {
    const { gateway, rooms } = setup();
    const host = socket(HOST_ID, 'AAAA', 'id-AAAA');
    const bad = [
      { type: 'STOP', time: 1 },
      { type: 'PLAY', time: Infinity },
      { type: 'PLAY', time: -5 },
      { type: 'PLAY', time: 'abc' },
    ];
    for (const b of bad) {
      const result = await gateway.handlePlaybackEvent(host, {
        roomCode: 'AAAA',
        ...b,
      } as never);
      expect(result).toEqual({ ok: false });
    }
    expect(rooms.updateMany).not.toHaveBeenCalled();
  });

  it('keeps the paused state across a seek', async () => {
    const { gateway, rooms, playbackEvents } = setup();
    const host = socket(HOST_ID, 'AAAA', 'id-AAAA');
    await gateway.handlePlaybackEvent(host, {
      roomCode: 'AAAA',
      type: 'PAUSE',
      time: 100,
    });
    await gateway.handlePlaybackEvent(host, {
      roomCode: 'AAAA',
      type: 'SEEK',
      time: 600,
    });
    await jest.runAllTimersAsync();
    const last = playbackEvents().at(-1);
    expect(last).toMatchObject({ type: 'SEEK', time: 600, isPlaying: false });
    expect(rooms.updateMany).toHaveBeenLastCalledWith(
      { id: 'id-AAAA' },
      { playbackTime: 600, isPlaying: false },
    );
  });

  it('commits a pending seek before a following pause, in order', async () => {
    const { gateway, playbackEvents } = setup();
    const host = socket(HOST_ID, 'AAAA', 'id-AAAA');
    await gateway.handlePlaybackEvent(host, {
      roomCode: 'AAAA',
      type: 'SEEK',
      time: 1200,
    });
    await gateway.handlePlaybackEvent(host, {
      roomCode: 'AAAA',
      type: 'PAUSE',
      time: 1200,
    });
    await jest.runAllTimersAsync();
    const events = playbackEvents();
    expect(events.map((e) => [e.type, e.time, e.seq])).toEqual([
      ['SEEK', 1200, 1],
      ['PAUSE', 1200, 2],
    ]);
  });

  it('does not reject when persisting a debounced seek fails', async () => {
    const { gateway, rooms } = setup();
    rooms.updateMany.mockRejectedValueOnce(new Error('db down'));
    const host = socket(HOST_ID, 'AAAA', 'id-AAAA');
    await gateway.handlePlaybackEvent(host, {
      roomCode: 'AAAA',
      type: 'SEEK',
      time: 10,
    });
    await expect(jest.runAllTimersAsync()).resolves.not.toThrow();
    const result = await gateway.handlePlaybackEvent(host, {
      roomCode: 'AAAA',
      type: 'PLAY',
      time: 10,
    });
    expect(result).toEqual({ ok: true });
  });

  it('forgets cached playback when the room is cleared', async () => {
    const { gateway } = setup();
    const host = socket(HOST_ID, 'AAAA', 'id-AAAA');
    await gateway.handlePlaybackEvent(host, {
      roomCode: 'AAAA',
      type: 'PLAY',
      time: 50,
    });
    await gateway.clearRoomState('aaaa');
    await gateway.applyPlaybackUpdate('AAAA', 'id-AAAA', 5, false);
    const events = (
      gateway as unknown as {
        playbackByRoom: Map<string, PlaybackStateMsg>;
      }
    ).playbackByRoom;
    expect(events.get('AAAA')).toMatchObject({ seq: 1, time: 5 });
  });
});
